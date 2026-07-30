import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
} from '../../packages/schemas/src/index.js';
import { compactSpeechTimeline } from '../../apps/generation-worker/src/timeline-recovery.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function recentCount(total: number): number {
  const raw = argument('recent');
  if (raw === undefined) {
    return total;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > total) {
    throw new Error(`--recent must be an integer from 1 to ${total}`);
  }
  return value;
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const afterSegmentId = argument('after');
const afterIndex =
  afterSegmentId === undefined
    ? -1
    : manifest.segments.findIndex((entry) => entry.segmentId === afterSegmentId);
if (afterSegmentId !== undefined && afterIndex === -1) {
  throw new Error(`--after segment is absent from the manifest: ${afterSegmentId}`);
}
const selectedEntries =
  afterIndex >= 0
    ? manifest.segments.slice(afterIndex + 1)
    : manifest.segments.slice(manifest.segments.length - recentCount(manifest.segments.length));
const selectedIds = new Set(selectedEntries.map((entry) => entry.segmentId));
const apply = process.argv.includes('--apply');
const nextEntries: PlayoutManifest['segments'] = [];
let changedSegmentCount = 0;
let removedDurationMs = 0;
let tightenedGapCount = 0;
let tightenedLeadCount = 0;

for (const entry of manifest.segments) {
  if (!selectedIds.has(entry.segmentId)) {
    nextEntries.push(entry);
    continue;
  }
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
  const pacing = segment.pacing ?? 'conversational';
  const compacted = compactSpeechTimeline(segment.events, pacing);
  if (compacted.removedDurationMs === 0) {
    nextEntries.push(entry);
    continue;
  }
  const nextDurationMs = segment.durationMs - compacted.removedDurationMs;
  const nextSegment = segmentPackageSchema.parse({
    ...segment,
    durationMs: nextDurationMs,
    events: compacted.events,
    suggestedExit: {
      ...segment.suggestedExit,
      earliestMs: Math.max(0, segment.suggestedExit.earliestMs - compacted.removedDurationMs),
      preferredMs: Math.max(0, segment.suggestedExit.preferredMs - compacted.removedDurationMs),
    },
  });
  if (apply) {
    const nextPath = `${segmentPath}.${process.pid}.next`;
    await writeFile(nextPath, `${JSON.stringify(nextSegment, null, 2)}\n`, 'utf8');
    await rename(nextPath, segmentPath);
  }
  changedSegmentCount += 1;
  tightenedGapCount += compacted.tightenedGapCount;
  tightenedLeadCount += Number(compacted.leadReductionMs > 0);
  removedDurationMs += compacted.removedDurationMs;
  nextEntries.push({ ...entry, durationMs: nextDurationMs });
}

const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  totalDurationMs: nextEntries.reduce((total, entry) => total + entry.durationMs, 0),
  segments: nextEntries,
});
if (apply && changedSegmentCount > 0) {
  const nextPath = `${manifestPath}.${process.pid}.next`;
  await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  await rename(nextPath, manifestPath);
}

process.stdout.write(
  `${JSON.stringify({
    applied: apply,
    selectedSegmentCount: selectedEntries.length,
    changedSegmentCount,
    tightenedGapCount,
    tightenedLeadCount,
    removedDurationMs,
    nextDurationMs: nextManifest.totalDurationMs,
  })}\n`,
);
