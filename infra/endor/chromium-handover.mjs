/* global AbortSignal, WebSocket, fetch */

import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';

const [command, ...arguments_] = process.argv.slice(2);
const stateRoot = path.resolve(process.env.ELSEWHERE_HANDOVER_STATE_DIR ?? '/state');
const rendererRoot = path.resolve(
  process.env.ELSEWHERE_HANDOVER_RENDERER_ROOT ?? '/app/apps/renderer',
);
const stagingRoot = path.resolve(process.env.ELSEWHERE_HANDOVER_STAGING_ROOT ?? '/tmp');
const activeStatePath = path.join(stateRoot, 'renderer-active.json');
const playbackHistoryKey = 'elsewhere-cable.played-segments.v1';

function profilePath(slot) {
  return path.join(stateRoot, slot === null ? 'chromium' : `chromium-${slot}`);
}

function assertPort(value) {
  const port = Number.parseInt(value ?? '', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('A valid Chromium debugging port is required');
  }
  return port;
}

function assertProfile(value) {
  const allowedProfiles = [
    profilePath(null),
    profilePath('a'),
    profilePath('b'),
    profilePath('probe'),
  ];
  if (!allowedProfiles.includes(path.resolve(value ?? ''))) {
    throw new Error('Chromium profile is outside the permitted handover state directory');
  }
  return path.resolve(value);
}

async function activeState() {
  try {
    const value = JSON.parse(await readFile(activeStatePath, 'utf8'));
    if (
      (value.slot !== 'a' && value.slot !== 'b') ||
      value.profile !== profilePath(value.slot) ||
      value.port !== (value.slot === 'a' ? 9222 : 9223) ||
      typeof value.build !== 'string'
    ) {
      throw new Error('Renderer active state is malformed');
    }
    return value;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function pageTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(1_500),
  });
  if (!response.ok) {
    throw new Error(`Chromium debugging endpoint returned HTTP ${response.status}`);
  }
  const targets = await response.json();
  const target = targets.find(
    (candidate) =>
      candidate.type === 'page' &&
      typeof candidate.webSocketDebuggerUrl === 'string' &&
      typeof candidate.url === 'string' &&
      candidate.url.includes('127.0.0.1:4174'),
  );
  if (target === undefined) {
    throw new Error('No Elsewhere Cable page target is available');
  }
  return target;
}

async function evaluate(port, expression, awaitPromise = false) {
  const target = await pageTarget(port);
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Chromium evaluation timed out'));
    }, 5_000);
    const finish = (callback) => {
      clearTimeout(timeout);
      socket.close();
      callback();
    };
    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression,
            awaitPromise,
            returnByValue: true,
          },
        }),
      );
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) {
        return;
      }
      if (message.error !== undefined) {
        finish(() => reject(new Error(message.error.message ?? 'Chromium evaluation failed')));
        return;
      }
      const evaluation = message.result;
      if (evaluation?.exceptionDetails !== undefined) {
        finish(() =>
          reject(
            new Error(
              evaluation.exceptionDetails.exception?.description ??
                evaluation.exceptionDetails.text ??
                'Renderer evaluation raised an exception',
            ),
          ),
        );
        return;
      }
      finish(() => resolve(evaluation?.result?.value));
    });
    socket.addEventListener('error', () => {
      finish(() => reject(new Error('Could not connect to Chromium debugging target')));
    });
  });
}

const rendererStatusExpression = `({
  ready: window.__ELSEWHERE_RENDERER_READY__ === true,
  active: window.__ELSEWHERE_RENDERER_ACTIVE__ === true,
  standby: document.querySelector('#broadcast')?.classList.contains('handover-standby') === true,
  title: document.title,
  href: location.href
})`;

async function waitReady(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let latestError = 'renderer did not answer';
  while (Date.now() < deadline) {
    try {
      const status = await evaluate(port, rendererStatusExpression);
      if (status?.ready === true && status?.standby === true) {
        return status;
      }
      latestError = `renderer status was ${JSON.stringify(status)}`;
    } catch (error) {
      latestError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Standby renderer did not become ready: ${latestError}`);
}

async function playedSegmentIds(telemetryPath) {
  let telemetry = '';
  try {
    telemetry = await readFile(telemetryPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
  const lines = telemetry.split('\n');
  const segmentIds = new Set();
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      const observation = JSON.parse(line);
      if (
        observation.event === 'segment.started' &&
        typeof observation.segmentId === 'string' &&
        /^seg_[a-z0-9_]+$/u.test(observation.segmentId)
      ) {
        segmentIds.add(observation.segmentId);
      }
    } catch {
      // One damaged telemetry line must not prevent a renderer handover.
    }
  }
  return [...segmentIds];
}

async function handoverWindow(telemetryPath) {
  let telemetry = '';
  try {
    telemetry = await readFile(telemetryPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
  const lines = telemetry.split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (line === undefined || line.length === 0) {
      continue;
    }
    try {
      const observation = JSON.parse(line);
      if (
        observation.event !== 'segment.started' ||
        !Number.isFinite(observation.durationMs) ||
        observation.durationMs <= 0
      ) {
        continue;
      }
      const receivedAt = Date.parse(observation.serverReceivedAt ?? observation.observedAt ?? '');
      if (!Number.isFinite(receivedAt)) {
        continue;
      }
      const elapsedMs = Math.max(0, Date.now() - receivedAt);
      const remainingMs = observation.durationMs - elapsedMs;
      return {
        safe: elapsedMs >= 1_000 && remainingMs >= 10_000,
        segmentId: observation.segmentId,
        elapsedMs,
        remainingMs,
      };
    } catch {
      // One damaged telemetry line must not prevent a later valid observation.
    }
  }
  return { safe: false, reason: 'no-active-segment-observation' };
}

async function waitHandoverWindow(telemetryPath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let latest = { safe: false, reason: 'no-active-segment-observation' };
  while (Date.now() < deadline) {
    latest = await handoverWindow(telemetryPath);
    if (latest.safe) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No safe channel-change window appeared: ${JSON.stringify(latest)}`);
}

async function installBundle(stagingPath) {
  stagingPath = assertStagingPath(stagingPath);
  await readFile(`${stagingPath}/index.html`, 'utf8');
  const assets = await readdir(`${stagingPath}/assets`);
  if (assets.length === 0) {
    throw new Error('Renderer staging bundle has no assets');
  }
  const livePath = `${rendererRoot}/dist`;
  const previousPath = `${rendererRoot}/dist.previous`;
  await rm(previousPath, { recursive: true, force: true });
  await rename(livePath, previousPath);
  try {
    await rename(stagingPath, livePath);
  } catch (error) {
    await rename(previousPath, livePath);
    throw error;
  }
  return { installed: true, assetCount: assets.length };
}

async function prepareStaging(stagingPath) {
  stagingPath = assertStagingPath(stagingPath);
  await rm(stagingPath, { recursive: true, force: true });
  await mkdir(stagingPath, { recursive: true });
  return { prepared: true, stagingPath };
}

function assertStagingPath(value) {
  const resolved = path.resolve(value ?? '');
  const baseName = path.basename(resolved);
  if (
    path.dirname(resolved) !== stagingRoot ||
    !/^elsewhere-renderer-[a-z0-9._-]{1,80}$/u.test(baseName)
  ) {
    throw new Error('Renderer staging path is outside the permitted handover staging directory');
  }
  return resolved;
}

async function rollbackBundle() {
  const livePath = `${rendererRoot}/dist`;
  const previousPath = `${rendererRoot}/dist.previous`;
  try {
    await readFile(`${previousPath}/index.html`, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { rolledBack: false, reason: 'no-previous-bundle' };
    }
    throw error;
  }
  await rm(livePath, { recursive: true, force: true });
  await rename(previousPath, livePath);
  return { rolledBack: true };
}

async function terminateProfile(profile) {
  const processDirectories = (await readdir('/proc')).filter((entry) => /^\d+$/u.test(entry));
  const matched = [];
  for (const directory of processDirectories) {
    const pid = Number.parseInt(directory, 10);
    if (pid === process.pid) {
      continue;
    }
    try {
      const commandLine = (await readFile(`/proc/${directory}/cmdline`))
        .toString('utf8')
        .split('\0')
        .filter(Boolean);
      if (commandLine.includes(`--user-data-dir=${profile}`)) {
        process.kill(pid, 'SIGTERM');
        matched.push(pid);
      }
    } catch {
      // Processes can exit while /proc is being inspected.
    }
  }
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && matched.some((pid) => processExists(pid))) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const pid of matched) {
    if (processExists(pid)) {
      process.kill(pid, 'SIGKILL');
    }
  }
  return matched.length;
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

switch (command) {
  case 'launch-settings': {
    const current = await activeState();
    const slot = current?.slot ?? 'a';
    const profile = profilePath(slot);
    const port = slot === 'a' ? 9222 : 9223;
    process.stdout.write(`${profile} ${port} ${slot}\n`);
    break;
  }
  case 'next-slot': {
    const current = await activeState();
    process.stdout.write(`${current?.slot === 'a' ? 'b' : 'a'}\n`);
    break;
  }
  case 'active-profile': {
    const current = await activeState();
    process.stdout.write(`${current?.profile ?? profilePath(null)}\n`);
    break;
  }
  case 'prepare-profile': {
    const profile = assertProfile(arguments_[0]);
    await Promise.all(
      ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].map((fileName) =>
        rm(`${profile}/${fileName}`, { force: true }),
      ),
    );
    process.stdout.write(`${JSON.stringify({ prepared: true, profile })}\n`);
    break;
  }
  case 'terminate-profile': {
    const profile = assertProfile(arguments_[0]);
    const terminatedProcessCount = await terminateProfile(profile);
    process.stdout.write(`${JSON.stringify({ profile, terminatedProcessCount })}\n`);
    break;
  }
  case 'wait-ready': {
    const port = assertPort(arguments_[0]);
    const timeoutMs = Number.parseInt(arguments_[1] ?? '30000', 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
      throw new Error('Ready timeout must be an integer from 1000 to 120000 milliseconds');
    }
    process.stdout.write(`${JSON.stringify(await waitReady(port, timeoutMs))}\n`);
    break;
  }
  case 'seed-history': {
    const port = assertPort(arguments_[0]);
    const telemetryPath = arguments_[1] ?? path.join(stateRoot, 'playout-observations.ndjson');
    const segmentIds = await playedSegmentIds(telemetryPath);
    const expression = `localStorage.setItem(${JSON.stringify(playbackHistoryKey)}, ${JSON.stringify(
      JSON.stringify(segmentIds),
    )}); ${segmentIds.length}`;
    const seededSegmentCount = await evaluate(port, expression);
    process.stdout.write(`${JSON.stringify({ seededSegmentCount })}\n`);
    break;
  }
  case 'probe-data': {
    const port = assertPort(arguments_[0]);
    const result = await evaluate(
      port,
      `(async () => {
        const manifestResponse = await fetch('/api/playout/manifest', { cache: 'no-store' });
        if (!manifestResponse.ok) {
          throw new Error('Manifest returned HTTP ' + manifestResponse.status);
        }
        const manifest = await manifestResponse.json();
        const played = new Set(JSON.parse(localStorage.getItem(${JSON.stringify(playbackHistoryKey)}) ?? '[]'));
        const entry = manifest.segments.find((candidate) => !played.has(candidate.segmentId));
        if (entry === undefined) {
          throw new Error('No unplayed segment is available to probe');
        }
        const segmentResponse = await fetch('/api/playout/segments/' + encodeURIComponent(entry.segmentId), { cache: 'no-store' });
        if (!segmentResponse.ok) {
          throw new Error('Segment returned HTTP ' + segmentResponse.status);
        }
        const segment = await segmentResponse.json();
        return {
          segmentCount: manifest.segments.length,
          segmentId: segment.segmentId,
          eventCount: Array.isArray(segment.events) ? segment.events.length : 0
        };
      })()`,
      true,
    );
    if (
      !Number.isInteger(result?.segmentCount) ||
      result.segmentCount < 1 ||
      typeof result.segmentId !== 'string' ||
      !Number.isInteger(result.eventCount) ||
      result.eventCount < 1
    ) {
      throw new Error(`Renderer data probe failed: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
    break;
  }
  case 'wait-handover-window': {
    const telemetryPath = arguments_[0] ?? path.join(stateRoot, 'playout-observations.ndjson');
    const timeoutMs = Number.parseInt(arguments_[1] ?? '120000', 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 300_000) {
      throw new Error(
        'Handover-window timeout must be an integer from 1000 to 300000 milliseconds',
      );
    }
    process.stdout.write(`${JSON.stringify(await waitHandoverWindow(telemetryPath, timeoutMs))}\n`);
    break;
  }
  case 'activate': {
    const port = assertPort(arguments_[0]);
    await evaluate(port, `window.__ELSEWHERE_ACTIVATE__().then(() => true)`, true);
    const status = await evaluate(port, rendererStatusExpression);
    if (status?.active !== true || status?.standby === true) {
      throw new Error(`Renderer activation did not complete: ${JSON.stringify(status)}`);
    }
    process.stdout.write(`${JSON.stringify(status)}\n`);
    break;
  }
  case 'status': {
    const port = assertPort(arguments_[0]);
    process.stdout.write(`${JSON.stringify(await evaluate(port, rendererStatusExpression))}\n`);
    break;
  }
  case 'record-active': {
    const slot = arguments_[0];
    const build = arguments_[1];
    if ((slot !== 'a' && slot !== 'b') || !/^[a-z0-9._-]{1,80}$/u.test(build ?? '')) {
      throw new Error('record-active requires slot a or b and a safe build identifier');
    }
    const state = {
      slot,
      profile: profilePath(slot),
      port: slot === 'a' ? 9222 : 9223,
      build,
      activatedAt: new Date().toISOString(),
    };
    const nextPath = `${activeStatePath}.next`;
    await writeFile(nextPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(nextPath, activeStatePath);
    process.stdout.write(`${JSON.stringify(state)}\n`);
    break;
  }
  case 'install-bundle': {
    process.stdout.write(`${JSON.stringify(await installBundle(arguments_[0]))}\n`);
    break;
  }
  case 'prepare-staging': {
    process.stdout.write(`${JSON.stringify(await prepareStaging(arguments_[0]))}\n`);
    break;
  }
  case 'rollback-bundle': {
    process.stdout.write(`${JSON.stringify(await rollbackBundle())}\n`);
    break;
  }
  default:
    throw new Error(
      'Usage: chromium-handover <launch-settings|next-slot|active-profile|prepare-profile|terminate-profile|wait-ready|wait-handover-window|seed-history|probe-data|activate|status|record-active|prepare-staging|install-bundle|rollback-bundle>',
    );
}
