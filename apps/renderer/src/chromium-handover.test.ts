import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const temporaryDirectories: string[] = [];
const workspaceRoot = path.resolve(import.meta.dirname, '../../..');
const helperPath = path.join(workspaceRoot, 'infra/endor/chromium-handover.mjs');

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-handover-'));
  temporaryDirectories.push(root);
  const stateRoot = path.join(root, 'state');
  const rendererRoot = path.join(root, 'renderer');
  const stagingRoot = path.join(root, 'staging');
  await Promise.all([
    mkdir(stateRoot, { recursive: true }),
    mkdir(path.join(rendererRoot, 'dist/assets'), { recursive: true }),
    mkdir(stagingRoot, { recursive: true }),
  ]);
  const environment = {
    ...process.env,
    ELSEWHERE_HANDOVER_STATE_DIR: stateRoot,
    ELSEWHERE_HANDOVER_LEGACY_PROFILE: path.join(root, 'legacy-chromium'),
    ELSEWHERE_HANDOVER_RENDERER_ROOT: rendererRoot,
    ELSEWHERE_HANDOVER_STAGING_ROOT: stagingRoot,
  };
  const run = async (...arguments_: string[]) =>
    (
      await execute(process.execPath, [helperPath, ...arguments_], { env: environment })
    ).stdout.trim();
  return { root, stateRoot, rendererRoot, stagingRoot, run };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('Chromium handover helper', () => {
  it('alternates renderer slots and records only bounded active state', async () => {
    const { stateRoot, run } = await fixture();

    await expect(run('next-slot')).resolves.toBe('a');
    await expect(run('launch-settings')).resolves.toContain('legacy-chromium 9222 legacy');
    const recorded = JSON.parse(await run('record-active', 'a', 'build-123')) as {
      slot: string;
      profile: string;
    };
    expect(recorded).toMatchObject({
      slot: 'a',
      profile: path.join(stateRoot, 'chromium-a'),
    });
    await expect(run('next-slot')).resolves.toBe('b');
    await expect(run('launch-settings')).resolves.toBe(
      `${path.join(stateRoot, 'chromium-a')} 9222 a`,
    );
    await expect(run('record-active', 'outside', 'build-123')).rejects.toThrow(
      'record-active requires slot a or b',
    );
  });

  it('atomically installs and rolls back a complete renderer bundle', async () => {
    const { rendererRoot, stagingRoot, run } = await fixture();
    await writeFile(path.join(rendererRoot, 'dist/index.html'), 'old renderer', 'utf8');
    await writeFile(path.join(rendererRoot, 'dist/assets/old.js'), 'old asset', 'utf8');
    const stagingPath = path.join(stagingRoot, 'elsewhere-renderer-build-123');
    await run('prepare-staging', stagingPath);
    await mkdir(path.join(stagingPath, 'assets'), { recursive: true });
    await writeFile(path.join(stagingPath, 'index.html'), 'new renderer', 'utf8');
    await writeFile(path.join(stagingPath, 'assets/new.js'), 'new asset', 'utf8');

    await run('install-bundle', stagingPath);
    await expect(readFile(path.join(rendererRoot, 'dist/index.html'), 'utf8')).resolves.toBe(
      'new renderer',
    );
    await expect(
      readFile(path.join(rendererRoot, 'dist.previous-index.html'), 'utf8'),
    ).resolves.toBe('old renderer');

    await run('rollback-bundle');
    await expect(readFile(path.join(rendererRoot, 'dist/index.html'), 'utf8')).resolves.toBe(
      'old renderer',
    );
  });

  it('waits for a segment with enough remaining time before switching browsers', async () => {
    const { stateRoot, run } = await fixture();
    const telemetryPath = path.join(stateRoot, 'playout-observations.ndjson');
    await writeFile(
      telemetryPath,
      `${JSON.stringify({
        event: 'segment.started',
        segmentId: 'seg_safe_handover',
        durationMs: 30_000,
        observedAt: new Date(Date.now() - 2_000).toISOString(),
      })}\n`,
      'utf8',
    );

    const result = JSON.parse(await run('wait-handover-window', telemetryPath, '2000')) as {
      safe: boolean;
      segmentId: string;
      remainingMs: number;
    };
    expect(result).toMatchObject({
      safe: true,
      segmentId: 'seg_safe_handover',
    });
    expect(result.remainingMs).toBeGreaterThan(20_000);
  });
});
