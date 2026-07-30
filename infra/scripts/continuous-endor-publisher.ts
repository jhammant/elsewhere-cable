import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';

interface PublisherState {
  lastPublishedManifestHash: string;
  observedSegmentIds: string[];
  publishedAt: string;
}

interface ManifestSnapshot {
  hash: string;
  segmentIds: string[];
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(
  workspaceRoot,
  argument('segments') ?? process.env.ELSEWHERE_LIVE_SEGMENTS_DIR ?? 'data/segments-live',
);
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const statePath = path.resolve(
  workspaceRoot,
  argument('state') ?? 'data/runtime/endor-publisher-state.json',
);
const once = process.argv.includes('--once');
const pollIntervalMs = Number.parseInt(
  argument('poll-ms') ?? process.env.ELSEWHERE_PUBLISH_POLL_MS ?? '20000',
  10,
);
const initialAuditCount = Number.parseInt(
  argument('initial-audit-count') ?? process.env.ELSEWHERE_INITIAL_AUDIT_COUNT ?? '4',
  10,
);
const livePriorityLookahead = Number.parseInt(
  argument('live-priority-lookahead') ?? process.env.ELSEWHERE_LIVE_PRIORITY_LOOKAHEAD ?? '3',
  10,
);
if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 5_000) {
  throw new Error('--poll-ms must be an integer of at least 5000');
}
if (!Number.isInteger(initialAuditCount) || initialAuditCount < 1 || initialAuditCount > 100) {
  throw new Error('--initial-audit-count must be an integer from 1 to 100');
}
if (
  !Number.isInteger(livePriorityLookahead) ||
  livePriorityLookahead < 1 ||
  livePriorityLookahead > 12
) {
  throw new Error('--live-priority-lookahead must be an integer from 1 to 12');
}

function log(event: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'endor-content-publisher',
      event,
      ...fields,
    })}\n`,
  );
}

function hashManifest(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function readSnapshot(): Promise<ManifestSnapshot> {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = playoutManifestSchema.parse(JSON.parse(raw));
  return {
    hash: hashManifest(raw),
    segmentIds: manifest.segments.map((entry) => entry.segmentId),
  };
}

async function readStableSnapshot(): Promise<ManifestSnapshot | null> {
  const first = await readSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const second = await readSnapshot();
  return first.hash === second.hash ? second : null;
}

async function loadState(): Promise<PublisherState | null> {
  try {
    const value = JSON.parse(await readFile(statePath, 'utf8')) as Partial<PublisherState>;
    if (
      typeof value.lastPublishedManifestHash !== 'string' ||
      !Array.isArray(value.observedSegmentIds) ||
      value.observedSegmentIds.some((segmentId) => typeof segmentId !== 'string') ||
      typeof value.publishedAt !== 'string'
    ) {
      throw new Error('Publisher state is malformed');
    }
    return value as PublisherState;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

async function saveState(state: PublisherState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  const nextPath = `${statePath}.next`;
  await writeFile(nextPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(nextPath, statePath);
}

async function run(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-16_000);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-16_000);
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        if (stdout.trim().length > 0) {
          log('command_output', { command, output: stdout.trim() });
        }
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed (${signal ?? code ?? 'unknown'}): ${stderr || stdout}`,
        ),
      );
    });
  });
}

async function publishSnapshot(snapshot: ManifestSnapshot): Promise<void> {
  const pnpm = process.env.ELSEWHERE_PNPM_BIN ?? 'pnpm';
  await run(pnpm, ['endor:content:check', '--', '--segments', segmentsRoot]);
  await run(pnpm, ['endor:sync'], {
    ELSEWHERE_LOCAL_SEGMENTS_DIR: segmentsRoot,
  });
  log('published', {
    manifestHash: snapshot.hash,
    segmentCount: snapshot.segmentIds.length,
  });
}

async function publishOnce(): Promise<void> {
  const snapshot = await readStableSnapshot();
  if (snapshot === null) {
    log('manifest_changing', { action: 'postpone' });
    return;
  }
  const state = await loadState();
  if (state === null) {
    const initialIds = snapshot.segmentIds.slice(-initialAuditCount);
    const pnpm = process.env.ELSEWHERE_PNPM_BIN ?? 'pnpm';
    log('auditing_initial_segments', { segmentCount: initialIds.length });
    await run(pnpm, [
      'reservoir:audit',
      '--',
      '--segments',
      segmentsRoot,
      '--apply',
      '--segment-ids',
      initialIds.join(','),
    ]);
    const auditedSnapshot = await readStableSnapshot();
    if (auditedSnapshot === null) {
      log('manifest_changed_during_initial_audit', { action: 'postpone' });
      return;
    }
    await publishSnapshot(auditedSnapshot);
    await saveState({
      lastPublishedManifestHash: auditedSnapshot.hash,
      observedSegmentIds: snapshot.segmentIds,
      publishedAt: new Date().toISOString(),
    });
    log('initialised', { segmentCount: auditedSnapshot.segmentIds.length });
    return;
  }

  const observedIds = new Set(state.observedSegmentIds);
  const newIds = snapshot.segmentIds.filter((segmentId) => !observedIds.has(segmentId));
  if (newIds.length > 0) {
    log('auditing_new_segments', { segmentCount: newIds.length });
    const pnpm = process.env.ELSEWHERE_PNPM_BIN ?? 'pnpm';
    await run(pnpm, [
      'reservoir:audit',
      '--',
      '--segments',
      segmentsRoot,
      '--apply',
      '--segment-ids',
      newIds.join(','),
    ]);
  }

  let auditedSnapshot = await readStableSnapshot();
  if (auditedSnapshot === null) {
    log('manifest_changed_during_audit', { action: 'postpone' });
    return;
  }
  const retainedIds = new Set(auditedSnapshot.segmentIds);
  const rejectedIds = newIds.filter((segmentId) => !retainedIds.has(segmentId));
  if (rejectedIds.length > 0) {
    log('segments_quarantined', { segmentIds: rejectedIds });
  }
  const retainedNewIds = newIds.filter((segmentId) => retainedIds.has(segmentId));
  if (retainedNewIds.length > 0) {
    const pnpm = process.env.ELSEWHERE_PNPM_BIN ?? 'pnpm';
    await run(pnpm, [
      'reservoir:prioritise-live',
      '--',
      '--segments',
      segmentsRoot,
      '--segment-ids',
      retainedNewIds.join(','),
      '--lookahead',
      String(livePriorityLookahead),
    ]);
    const prioritisedSnapshot = await readStableSnapshot();
    if (prioritisedSnapshot === null) {
      log('manifest_changed_during_live_priority', { action: 'postpone' });
      return;
    }
    auditedSnapshot = prioritisedSnapshot;
  }

  if (auditedSnapshot.hash !== state.lastPublishedManifestHash) {
    await publishSnapshot(auditedSnapshot);
  } else {
    log('up_to_date', { segmentCount: auditedSnapshot.segmentIds.length });
  }
  await saveState({
    lastPublishedManifestHash: auditedSnapshot.hash,
    observedSegmentIds: [...new Set([...state.observedSegmentIds, ...newIds])],
    publishedAt:
      auditedSnapshot.hash === state.lastPublishedManifestHash
        ? state.publishedAt
        : new Date().toISOString(),
  });
}

let running = true;
while (running) {
  try {
    await publishOnce();
  } catch (error) {
    log('publish_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (once) {
      process.exitCode = 1;
    }
  }
  running = !once;
  if (running) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
