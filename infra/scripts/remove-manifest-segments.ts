import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const segmentIds = (argument('segment-ids') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (
  segmentIds.length === 0 ||
  segmentIds.some((segmentId) => !/^seg_[a-z0-9_]+$/u.test(segmentId)) ||
  new Set(segmentIds).size !== segmentIds.length
) {
  throw new Error('--segment-ids must contain unique, comma-separated segment IDs');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const removalSet = new Set(segmentIds);
const missingIds = segmentIds.filter(
  (segmentId) => !manifest.segments.some((entry) => entry.segmentId === segmentId),
);
if (missingIds.length > 0) {
  throw new Error(`Cannot remove absent manifest segments: ${missingIds.join(', ')}`);
}
const retainedSegments = manifest.segments.filter((entry) => !removalSet.has(entry.segmentId));
if (retainedSegments.length === 0) {
  throw new Error('Refusing to remove every manifest segment');
}
const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  totalDurationMs: retainedSegments.reduce((total, entry) => total + entry.durationMs, 0),
  segments: retainedSegments,
});

const nextPath = `${manifestPath}.${process.pid}.next`;
await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
await rename(nextPath, manifestPath);

process.stdout.write(
  `${JSON.stringify({
    removedSegmentIds: segmentIds,
    removedSegmentCount: segmentIds.length,
    retainedSegmentCount: retainedSegments.length,
    retainedDurationMs: nextManifest.totalDurationMs,
  })}\n`,
);
