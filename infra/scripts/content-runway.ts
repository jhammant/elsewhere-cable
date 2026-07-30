import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
  type SegmentPackage,
} from '../../packages/schemas/src/index.js';
import {
  diversifyRunway,
  runwayDiversityMetrics,
  type RunwayDescriptor,
} from '../../apps/generation-worker/src/runway-diversity.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function contentFingerprint(segment: SegmentPackage): string {
  const editorialEvents: Array<
    | { type: 'speech.play'; characterName: string; subtitle: string }
    | { type: 'graphic.show'; graphic: string; text: string }
  > = [];
  for (const event of segment.events) {
    if (event.type === 'speech.play') {
      editorialEvents.push({
        type: event.type,
        characterName: event.characterName,
        subtitle: event.subtitle,
      });
    }
    if (event.type === 'graphic.show') {
      editorialEvents.push({ type: event.type, graphic: event.graphic, text: event.text });
    }
  }
  return createHash('sha256')
    .update(
      JSON.stringify({
        channelName: segment.channel.name,
        programmeTitle: segment.programme.title,
        format: segment.programme.format,
        premise: segment.programme.premise,
        editorialEvents,
        continuityUpdates: segment.continuityUpdates,
      }),
    )
    .digest('hex');
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const playedIdsPath = argument('played-ids');
if (playedIdsPath === undefined) {
  throw new Error('--played-ids must point to a newline-delimited segment ID file');
}
const afterSegmentId = argument('after');
const freshIdsOutput = argument('fresh-ids-output');
const apply = process.argv.includes('--apply');
const deduplicate = process.argv.includes('--deduplicate');
const diversify = process.argv.includes('--diversify');
if (afterSegmentId !== undefined && !/^seg_[a-z0-9_]+$/u.test(afterSegmentId)) {
  throw new Error('--after must be a valid segment ID');
}
if (apply && afterSegmentId === undefined) {
  throw new Error('--apply requires --after');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const afterSegmentIndex =
  afterSegmentId === undefined
    ? -1
    : manifest.segments.findIndex((entry) => entry.segmentId === afterSegmentId);
if (afterSegmentId !== undefined && afterSegmentIndex === -1) {
  throw new Error(`--after segment is absent from the manifest: ${afterSegmentId}`);
}
const manifestEntries = new Map(
  manifest.segments.map((entry) => [entry.segmentId, entry] as const),
);
const playedIds = new Set(
  (await readFile(path.resolve(workspaceRoot, playedIdsPath), 'utf8'))
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => /^seg_[a-z0-9_]+$/u.test(value)),
);
const segmentCache = new Map<string, Promise<SegmentPackage>>();

function readSegment(segmentId: string): Promise<SegmentPackage> {
  const cached = segmentCache.get(segmentId);
  if (cached !== undefined) {
    return cached;
  }
  const entry = manifestEntries.get(segmentId);
  const segmentPath =
    entry === undefined
      ? path.join(segmentsRoot, segmentId, 'segment.json')
      : path.join(segmentsRoot, entry.packagePath);
  const loaded = readFile(segmentPath, 'utf8').then((value) =>
    segmentPackageSchema.parse(JSON.parse(value)),
  );
  segmentCache.set(segmentId, loaded);
  return loaded;
}

const playedFingerprints = new Set<string>();
let missingPlayedPackages = 0;
for (const segmentId of playedIds) {
  try {
    playedFingerprints.add(contentFingerprint(await readSegment(segmentId)));
  } catch {
    missingPlayedPackages += 1;
  }
}

type Classification = 'played' | 'fresh' | 'repeat';
const classifications = new Map<string, Classification>();
const knownFingerprints = new Set(playedFingerprints);
let idUnseenDurationMs = 0;
let contentFreshDurationMs = 0;
let contentRepeatDurationMs = 0;
let idUnseenCount = 0;
let contentFreshCount = 0;
let contentRepeatCount = 0;

for (const entry of manifest.segments) {
  if (playedIds.has(entry.segmentId)) {
    classifications.set(entry.segmentId, 'played');
    continue;
  }
  idUnseenCount += 1;
  idUnseenDurationMs += entry.durationMs;
  const fingerprint = contentFingerprint(await readSegment(entry.segmentId));
  if (knownFingerprints.has(fingerprint)) {
    classifications.set(entry.segmentId, 'repeat');
    contentRepeatCount += 1;
    contentRepeatDurationMs += entry.durationMs;
  } else {
    knownFingerprints.add(fingerprint);
    classifications.set(entry.segmentId, 'fresh');
    contentFreshCount += 1;
    contentFreshDurationMs += entry.durationMs;
  }
}

let reordered = false;
let deduplicated = false;
let diversified = false;
let removedDuplicateCount = 0;
let removedDuplicateDurationMs = 0;
let diversityBefore: ReturnType<typeof runwayDiversityMetrics> | null = null;
let diversityAfter: ReturnType<typeof runwayDiversityMetrics> | null = null;
let nextManifest: PlayoutManifest = manifest;
if (apply) {
  const currentIndex = afterSegmentIndex;
  const currentEntry = manifest.segments[currentIndex]!;
  let nextSegments: PlayoutManifest['segments'];
  if (deduplicate) {
    const prefix = manifest.segments.slice(0, currentIndex + 1);
    const originalFuture = manifest.segments.slice(currentIndex + 1);
    const removed = deduplicate
      ? originalFuture.filter((entry) => classifications.get(entry.segmentId) === 'repeat')
      : [];
    let future = deduplicate
      ? originalFuture.filter((entry) => classifications.get(entry.segmentId) !== 'repeat')
      : originalFuture;
    removedDuplicateCount = removed.length;
    removedDuplicateDurationMs = removed.reduce((total, entry) => total + entry.durationMs, 0);
    deduplicated = deduplicate && removed.length > 0;
    if (diversify && future.length > 1) {
      const descriptors = await Promise.all(
        future.map(async (entry) => {
          const segment = await readSegment(entry.segmentId);
          return {
            entry,
            segmentId: segment.segmentId,
            channelId: segment.channel.id,
            programmeId: segment.programme.id,
            format: segment.programme.format,
            visualMedium: segment.visualMedium ?? 'legacy',
            pacing: segment.pacing ?? 'conversational',
            storyMode: segment.storyMode ?? 'legacy',
          };
        }),
      );
      const currentSegment = await readSegment(currentEntry.segmentId);
      const preceding: RunwayDescriptor = {
        segmentId: currentSegment.segmentId,
        channelId: currentSegment.channel.id,
        programmeId: currentSegment.programme.id,
        format: currentSegment.programme.format,
        visualMedium: currentSegment.visualMedium ?? 'legacy',
        pacing: currentSegment.pacing ?? 'conversational',
        storyMode: currentSegment.storyMode ?? 'legacy',
      };
      diversityBefore = runwayDiversityMetrics(descriptors);
      const diversifiedDescriptors = diversifyRunway(descriptors, preceding);
      diversityAfter = runwayDiversityMetrics(diversifiedDescriptors);
      future = diversifiedDescriptors.map(({ entry }) => entry);
      diversified = future.some(
        (entry, index) => entry.segmentId !== originalFuture[index]?.segmentId,
      );
    }
    nextSegments = [...prefix, ...future];
  } else {
    const cyclicEntries = Array.from(
      { length: manifest.segments.length - 1 },
      (_, offset) => manifest.segments[(currentIndex + 1 + offset) % manifest.segments.length]!,
    );
    const priorityGroups = [
      cyclicEntries.filter((entry) => classifications.get(entry.segmentId) === 'fresh'),
      cyclicEntries.filter((entry) => classifications.get(entry.segmentId) === 'repeat'),
      cyclicEntries.filter((entry) => classifications.get(entry.segmentId) === 'played'),
    ];
    let priorityEntries = priorityGroups.flat();
    if (diversify && priorityEntries.length > 1) {
      const currentSegment = await readSegment(currentEntry.segmentId);
      let preceding: RunwayDescriptor = {
        segmentId: currentSegment.segmentId,
        channelId: currentSegment.channel.id,
        programmeId: currentSegment.programme.id,
        format: currentSegment.programme.format,
        visualMedium: currentSegment.visualMedium ?? 'legacy',
        pacing: currentSegment.pacing ?? 'conversational',
        storyMode: currentSegment.storyMode ?? 'legacy',
      };
      const originalDescriptors = [];
      const diversifiedDescriptors = [];
      for (const group of priorityGroups) {
        const descriptors = await Promise.all(
          group.map(async (entry) => {
            const segment = await readSegment(entry.segmentId);
            return {
              entry,
              segmentId: segment.segmentId,
              channelId: segment.channel.id,
              programmeId: segment.programme.id,
              format: segment.programme.format,
              visualMedium: segment.visualMedium ?? 'legacy',
              pacing: segment.pacing ?? 'conversational',
              storyMode: segment.storyMode ?? 'legacy',
            };
          }),
        );
        originalDescriptors.push(...descriptors);
        const diversifiedGroup = diversifyRunway(descriptors, preceding);
        diversifiedDescriptors.push(...diversifiedGroup);
        preceding = diversifiedGroup.at(-1) ?? preceding;
      }
      diversityBefore = runwayDiversityMetrics(originalDescriptors);
      diversityAfter = runwayDiversityMetrics(diversifiedDescriptors);
      priorityEntries = diversifiedDescriptors.map(({ entry }) => entry);
      diversified = priorityEntries.some(
        (entry, index) => entry.segmentId !== cyclicEntries[index]?.segmentId,
      );
    }
    nextSegments = [...manifest.segments];
    nextSegments[currentIndex] = currentEntry;
    for (const [offset, entry] of priorityEntries.entries()) {
      nextSegments[(currentIndex + 1 + offset) % nextSegments.length] = entry;
    }
    reordered = true;
  }
  nextManifest = playoutManifestSchema.parse({
    ...manifest,
    generatedAt: new Date().toISOString(),
    totalDurationMs: nextSegments.reduce((total, entry) => total + entry.durationMs, 0),
    segments: nextSegments,
  });
  const nextPath = `${manifestPath}.${process.pid}.next`;
  await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  await rename(nextPath, manifestPath);
}

const previewStart =
  afterSegmentId === undefined
    ? 0
    : Math.max(
        0,
        nextManifest.segments.findIndex((entry) => entry.segmentId === afterSegmentId) + 1,
      );
const nextContent = Array.from(
  { length: Math.min(12, nextManifest.segments.length) },
  (_, offset) => {
    const entry = nextManifest.segments[(previewStart + offset) % nextManifest.segments.length]!;
    return {
      segmentId: entry.segmentId,
      programmeTitle: entry.programmeTitle,
      classification: classifications.get(entry.segmentId) ?? 'played',
    };
  },
);

let writtenFreshIds = 0;
if (freshIdsOutput !== undefined) {
  const orderedEntries =
    afterSegmentId === undefined
      ? nextManifest.segments
      : Array.from(
          { length: nextManifest.segments.length - 1 },
          (_, offset) =>
            nextManifest.segments[(afterSegmentIndex + 1 + offset) % nextManifest.segments.length]!,
        );
  const freshIds = orderedEntries
    .filter((entry) => classifications.get(entry.segmentId) === 'fresh')
    .map((entry) => entry.segmentId);
  const outputPath = path.resolve(workspaceRoot, freshIdsOutput);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const nextPath = `${outputPath}.${process.pid}.next`;
  await writeFile(nextPath, `${freshIds.join('\n')}\n`, 'utf8');
  await rename(nextPath, outputPath);
  writtenFreshIds = freshIds.length;
}

process.stdout.write(
  `${JSON.stringify(
    {
      manifestSegments: manifest.segments.length,
      playedIds: playedIds.size,
      playedFingerprints: playedFingerprints.size,
      missingPlayedPackages,
      idUnseen: {
        count: idUnseenCount,
        durationMs: idUnseenDurationMs,
        hours: Number((idUnseenDurationMs / 3_600_000).toFixed(3)),
      },
      contentFresh: {
        count: contentFreshCount,
        durationMs: contentFreshDurationMs,
        hours: Number((contentFreshDurationMs / 3_600_000).toFixed(3)),
      },
      contentRepeatReserve: {
        count: contentRepeatCount,
        durationMs: contentRepeatDurationMs,
        hours: Number((contentRepeatDurationMs / 3_600_000).toFixed(3)),
      },
      reordered,
      deduplicated,
      diversified,
      removedDuplicateCount,
      removedDuplicateDurationMs,
      diversityBefore,
      diversityAfter,
      writtenFreshIds,
      afterSegmentId: afterSegmentId ?? null,
      nextContent,
    },
    null,
    2,
  )}\n`,
);
