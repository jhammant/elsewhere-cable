import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
  type SegmentPackage,
} from '../../packages/schemas/src/index.js';
import {
  eventsWithinDuration,
  recoveryTimingTargets,
} from '../../apps/generation-worker/src/timeline-recovery.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function lastEventIndex(
  events: SegmentPackage['events'],
  predicate: (event: SegmentPackage['events'][number]) => boolean,
): number {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (predicate(events[index]!)) {
      return index;
    }
  }
  return -1;
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const apply = process.argv.includes('--apply');
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const afterSegmentId = argument('after');
const recentValue = argument('recent');
if (afterSegmentId !== undefined && recentValue !== undefined) {
  throw new Error('--after and --recent are mutually exclusive');
}
const recent = recentValue === undefined ? null : Number.parseInt(recentValue, 10);
if (recent !== null && (!Number.isInteger(recent) || recent < 1)) {
  throw new Error('--recent must be a positive integer');
}
const afterIndex =
  afterSegmentId === undefined
    ? -1
    : manifest.segments.findIndex((entry) => entry.segmentId === afterSegmentId);
if (afterSegmentId !== undefined && afterIndex === -1) {
  throw new Error(`--after segment is absent from the manifest: ${afterSegmentId}`);
}
const selectedIds =
  recent !== null
    ? new Set(
        manifest.segments
          .slice(Math.max(0, manifest.segments.length - recent))
          .map((entry) => entry.segmentId),
      )
    : afterIndex < 0
      ? null
      : new Set(manifest.segments.slice(afterIndex + 1).map((entry) => entry.segmentId));

let changedSegmentCount = 0;
let removedDurationMs = 0;
const nextEntries: PlayoutManifest['segments'] = [];

for (const entry of manifest.segments) {
  if (selectedIds !== null && !selectedIds.has(entry.segmentId)) {
    nextEntries.push(entry);
    continue;
  }
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
  const speechEvents = segment.events.filter((event) => event.type === 'speech.play');
  const lastSpeechEndMs = speechEvents.reduce(
    (latest, event) => Math.max(latest, event.atMs + event.durationMs),
    0,
  );
  if (lastSpeechEndMs === 0) {
    nextEntries.push(entry);
    continue;
  }
  const pacing = segment.pacing ?? 'conversational';
  const desiredDurationMs = Math.max(8_000, lastSpeechEndMs + recoveryTimingTargets[pacing].tailMs);
  const nextDurationMs = Math.min(segment.durationMs, desiredDurationMs);
  if (nextDurationMs >= segment.durationMs) {
    nextEntries.push(entry);
    continue;
  }

  const endingGraphicIndex = lastEventIndex(
    segment.events,
    (event) =>
      event.type === 'graphic.show' && event.graphic === 'WARNING' && event.atMs >= lastSpeechEndMs,
  );
  const endingTransitionIndex = lastEventIndex(
    segment.events,
    (event) =>
      event.type === 'transition.play' && event.atMs >= lastSpeechEndMs,
  );
  const nextEvents = eventsWithinDuration(
    segment.events.map((event, index) => {
      if (index === endingGraphicIndex) {
        return { ...event, atMs: Math.min(event.atMs, lastSpeechEndMs + 120) };
      }
      if (index === endingTransitionIndex) {
        return { ...event, atMs: nextDurationMs - 520 };
      }
      return event;
    }),
    nextDurationMs,
  );
  const nextSegment = segmentPackageSchema.parse({
    ...segment,
    durationMs: nextDurationMs,
    events: nextEvents,
    suggestedExit: {
      ...segment.suggestedExit,
      earliestMs: Math.max(0, nextDurationMs - 1_000),
      preferredMs: nextDurationMs,
    },
  });
  if (apply) {
    const nextSegmentPath = `${segmentPath}.${process.pid}.next`;
    await writeFile(nextSegmentPath, `${JSON.stringify(nextSegment, null, 2)}\n`, 'utf8');
    await rename(nextSegmentPath, segmentPath);
  }
  changedSegmentCount += 1;
  removedDurationMs += segment.durationMs - nextDurationMs;
  nextEntries.push({ ...entry, durationMs: nextDurationMs });
}

const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  totalDurationMs: nextEntries.reduce((total, entry) => total + entry.durationMs, 0),
  segments: nextEntries,
});
if (apply && changedSegmentCount > 0) {
  const nextManifestPath = `${manifestPath}.${process.pid}.next`;
  await writeFile(nextManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  await rename(nextManifestPath, manifestPath);
}

process.stdout.write(
  `${JSON.stringify({
    applied: apply,
    changedSegmentCount,
    removedDurationMs,
    nextDurationMs: nextManifest.totalDurationMs,
    segmentCount: nextManifest.segments.length,
  })}\n`,
);
