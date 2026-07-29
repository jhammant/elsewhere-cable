import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
  type SegmentPackage,
} from '../../packages/schemas/src/index.js';

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
const apply = process.argv.includes('--apply');
if (apply && (afterSegmentId === undefined || !/^seg_[a-z0-9_]+$/u.test(afterSegmentId))) {
  throw new Error('--apply requires a valid --after segment ID');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
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
let nextManifest: PlayoutManifest = manifest;
if (apply) {
  const currentIndex = manifest.segments.findIndex((entry) => entry.segmentId === afterSegmentId);
  if (currentIndex === -1) {
    throw new Error(`--after segment is absent from the manifest: ${afterSegmentId}`);
  }
  const currentEntry = manifest.segments[currentIndex]!;
  const cyclicEntries = Array.from(
    { length: manifest.segments.length - 1 },
    (_, offset) => manifest.segments[(currentIndex + 1 + offset) % manifest.segments.length]!,
  );
  const priorityEntries = [
    ...cyclicEntries.filter((entry) => classifications.get(entry.segmentId) === 'fresh'),
    ...cyclicEntries.filter((entry) => classifications.get(entry.segmentId) === 'repeat'),
    ...cyclicEntries.filter((entry) => classifications.get(entry.segmentId) === 'played'),
  ];
  const nextSegments = [...manifest.segments];
  nextSegments[currentIndex] = currentEntry;
  for (const [offset, entry] of priorityEntries.entries()) {
    nextSegments[(currentIndex + 1 + offset) % nextSegments.length] = entry;
  }
  nextManifest = playoutManifestSchema.parse({
    ...manifest,
    generatedAt: new Date().toISOString(),
    segments: nextSegments,
  });
  const nextPath = `${manifestPath}.${process.pid}.next`;
  await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  await rename(nextPath, manifestPath);
  reordered = true;
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
      afterSegmentId: afterSegmentId ?? null,
      nextContent,
    },
    null,
    2,
  )}\n`,
);
