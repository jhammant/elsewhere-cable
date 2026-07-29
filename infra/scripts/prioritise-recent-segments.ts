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
const afterSegmentId = argument('after');
if (afterSegmentId === undefined || !/^seg_[a-z0-9_]+$/u.test(afterSegmentId)) {
  throw new Error('--after must be a valid segment ID');
}
const selectedIdsArgument = argument('segment-ids');
const selectedIds =
  selectedIdsArgument === undefined
    ? []
    : selectedIdsArgument
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
if (
  selectedIds.some((segmentId) => !/^seg_[a-z0-9_]+$/u.test(segmentId)) ||
  new Set(selectedIds).size !== selectedIds.length
) {
  throw new Error('--segment-ids must contain unique, comma-separated segment IDs');
}
const recentArgument = argument('recent');
if (selectedIds.length > 0 && recentArgument !== undefined) {
  throw new Error('Use either --recent or --segment-ids, not both');
}
const recent = Number(recentArgument ?? 1);
if (selectedIds.length === 0 && (!Number.isInteger(recent) || recent < 1 || recent > 100)) {
  throw new Error('--recent must be an integer from 1 to 100');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
if (selectedIds.length === 0 && recent >= manifest.segments.length) {
  throw new Error('--recent must leave at least one existing manifest entry');
}
const selectedIdSet = new Set(selectedIds);
const priorityEntries =
  selectedIds.length === 0
    ? manifest.segments.slice(-recent)
    : selectedIds.map((segmentId) => {
        const entry = manifest.segments.find((candidate) => candidate.segmentId === segmentId);
        if (entry === undefined) {
          throw new Error(`Priority segment is absent from the manifest: ${segmentId}`);
        }
        return entry;
      });
if (priorityEntries.some((entry) => entry.segmentId === afterSegmentId)) {
  throw new Error('The insertion point cannot be inside the priority block');
}
const priorityIdSet =
  selectedIds.length === 0
    ? new Set(priorityEntries.map((entry) => entry.segmentId))
    : selectedIdSet;
const remainingEntries = manifest.segments.filter((entry) => !priorityIdSet.has(entry.segmentId));
const insertionIndex = remainingEntries.findIndex((entry) => entry.segmentId === afterSegmentId);
if (insertionIndex === -1) {
  throw new Error(`Insertion segment is absent from the manifest: ${afterSegmentId}`);
}
const nextSegments = [
  ...remainingEntries.slice(0, insertionIndex + 1),
  ...priorityEntries,
  ...remainingEntries.slice(insertionIndex + 1),
];
const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  segments: nextSegments,
});
const nextPath = `${manifestPath}.${process.pid}.next`;
await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
await rename(nextPath, manifestPath);

process.stdout.write(
  `${JSON.stringify({
    afterSegmentId,
    prioritisedSegmentCount: priorityEntries.length,
    firstPrioritisedSegmentId: priorityEntries[0]?.segmentId,
    lastPrioritisedSegmentId: priorityEntries.at(-1)?.segmentId,
    totalSegmentCount: nextSegments.length,
  })}\n`,
);
