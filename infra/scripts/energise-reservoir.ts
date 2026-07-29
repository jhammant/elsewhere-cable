import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type SegmentEvent,
  type SegmentPackage,
} from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requestedRecentCount(total: number): number {
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

function graphicForFormat(
  format: SegmentPackage['programme']['format'],
): 'LOWER_THIRD' | 'WARNING' | 'TITLE_CARD' {
  switch (format) {
    case 'advert':
    case 'ident':
    case 'sitcom':
      return 'TITLE_CARD';
    case 'emergency':
    case 'public_access':
      return 'WARNING';
    case 'news':
    case 'shopping':
      return 'LOWER_THIRD';
  }
}

function cameraEventsForSpeech(
  speech: Extract<SegmentEvent, { type: 'speech.play' }>,
  pacing: NonNullable<SegmentPackage['pacing']>,
  speakerIndex: number,
  existingEvents: readonly SegmentEvent[],
): SegmentEvent[] {
  if (speech.durationMs < 2_400 || pacing === 'slow_burn' || pacing === 'near_silent') {
    return [];
  }
  const cuts =
    pacing === 'frantic' && speech.durationMs >= 3_600
      ? [
          { fraction: 0.34, camera: 'CAMERA_WIDE' as const },
          {
            fraction: 0.7,
            camera: speakerIndex % 2 === 0 ? ('CAMERA_GUEST' as const) : ('CAMERA_HOST' as const),
          },
        ]
      : [{ fraction: 0.54, camera: 'CAMERA_WIDE' as const }];
  return cuts
    .map(({ fraction, camera }) => ({
      atMs: speech.atMs + Math.floor(speech.durationMs * fraction),
      type: 'camera.cut' as const,
      camera,
    }))
    .filter(
      (candidate) =>
        !existingEvents.some(
          (event) => event.type === 'camera.cut' && Math.abs(event.atMs - candidate.atMs) < 650,
        ),
    );
}

function energise(segment: SegmentPackage): {
  segment: SegmentPackage;
  cameraEventsAdded: number;
  graphicChanged: boolean;
} {
  const pacing = segment.pacing ?? 'conversational';
  const speech = segment.events.filter(
    (event): event is Extract<SegmentEvent, { type: 'speech.play' }> =>
      event.type === 'speech.play',
  );
  const additions = speech.flatMap((event, index) =>
    cameraEventsForSpeech(event, pacing, index, segment.events),
  );
  const finalGraphicIndex = segment.events.reduce(
    (latest, event, index) =>
      event.type === 'graphic.show' && event.atMs > segment.durationMs * 0.55 ? index : latest,
    -1,
  );
  const desiredGraphic = graphicForFormat(segment.programme.format);
  const graphicChanged =
    finalGraphicIndex >= 0 &&
    segment.events[finalGraphicIndex]?.type === 'graphic.show' &&
    segment.events[finalGraphicIndex].graphic !== desiredGraphic;
  const events = segment.events.map((event, index) =>
    index === finalGraphicIndex && event.type === 'graphic.show'
      ? { ...event, graphic: desiredGraphic }
      : event,
  );
  const nextSegment = segmentPackageSchema.parse({
    ...segment,
    events: [...events, ...additions].sort((left, right) => left.atMs - right.atMs),
  });
  return {
    segment: nextSegment,
    cameraEventsAdded: additions.length,
    graphicChanged,
  };
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const apply = process.argv.includes('--apply');
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const recentCount = requestedRecentCount(manifest.segments.length);
const selectedIds = new Set(
  manifest.segments.slice(manifest.segments.length - recentCount).map((entry) => entry.segmentId),
);

let changedSegmentCount = 0;
let cameraEventsAdded = 0;
let graphicsChanged = 0;
for (const entry of manifest.segments) {
  if (!selectedIds.has(entry.segmentId)) {
    continue;
  }
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
  const result = energise(segment);
  if (result.cameraEventsAdded === 0 && !result.graphicChanged) {
    continue;
  }
  changedSegmentCount += 1;
  cameraEventsAdded += result.cameraEventsAdded;
  graphicsChanged += Number(result.graphicChanged);
  if (apply) {
    const nextPath = `${segmentPath}.${process.pid}.next`;
    await writeFile(nextPath, `${JSON.stringify(result.segment, null, 2)}\n`, 'utf8');
    await rename(nextPath, segmentPath);
  }
}

process.stdout.write(
  `${JSON.stringify({
    applied: apply,
    selectedSegmentCount: recentCount,
    changedSegmentCount,
    cameraEventsAdded,
    graphicsChanged,
    segmentCount: manifest.segments.length,
  })}\n`,
);
