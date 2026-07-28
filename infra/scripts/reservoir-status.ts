import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(
  workspaceRoot,
  argument('segments') ?? process.env.ELSEWHERE_LIVE_SEGMENTS_DIR ?? 'data/segments-live',
);
const targetHours = Number(
  argument('target-hours') ?? process.env.ELSEWHERE_RESERVOIR_TARGET_HOURS ?? 72,
);
if (!Number.isFinite(targetHours) || targetHours <= 0 || targetHours > 24 * 365) {
  throw new Error('--target-hours must be a positive number no greater than 8760');
}

const manifest = playoutManifestSchema.parse(
  JSON.parse(await readFile(path.join(segmentsRoot, 'manifest.json'), 'utf8')),
);
const readyHours = manifest.totalDurationMs / 3_600_000;
const remainingHours = Math.max(0, targetHours - readyHours);
const targetReached = remainingHours === 0;
const averageSegmentSeconds =
  manifest.segments.length === 0 ? 0 : manifest.totalDurationMs / manifest.segments.length / 1_000;

process.stdout.write(
  `${JSON.stringify(
    {
      targetHours,
      readyHours: Number(readyHours.toFixed(3)),
      remainingHours: Number(remainingHours.toFixed(3)),
      completionPercent: Number(Math.min(100, (readyHours / targetHours) * 100).toFixed(2)),
      segmentCount: manifest.segments.length,
      averageSegmentSeconds: Number(averageSegmentSeconds.toFixed(1)),
      targetReached,
      segmentsRoot,
    },
    null,
    2,
  )}\n`,
);

if (process.argv.includes('--ready-check') && !targetReached) {
  process.exitCode = 1;
}
