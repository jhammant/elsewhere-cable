import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type SegmentEvent,
} from '../../packages/schemas/src/index.js';
import { LocalCommandTtsProvider } from '../../apps/generation-worker/src/providers.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function voiceIndex(characterName: string, voiceCount: number): number {
  let hash = 0;
  for (const character of characterName) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % voiceCount;
}

interface SpeechTiming {
  speechId: string;
  oldStartMs: number;
  oldDurationMs: number;
  newDurationMs: number;
}

function remapTime(timeMs: number, timings: readonly SpeechTiming[]): number {
  let cumulativeDeltaMs = 0;
  for (const timing of timings) {
    const oldEndMs = timing.oldStartMs + timing.oldDurationMs;
    const newStartMs = timing.oldStartMs + cumulativeDeltaMs;
    if (timeMs < timing.oldStartMs) {
      break;
    }
    if (timeMs <= oldEndMs) {
      const progress = (timeMs - timing.oldStartMs) / timing.oldDurationMs;
      return Math.round(newStartMs + progress * timing.newDurationMs);
    }
    cumulativeDeltaMs += timing.newDurationMs - timing.oldDurationMs;
  }
  return Math.max(0, Math.round(timeMs + cumulativeDeltaMs));
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(
  workspaceRoot,
  argument('segments') ?? process.env.ELSEWHERE_LIVE_SEGMENTS_DIR ?? 'data/segments-live',
);
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const tts = await LocalCommandTtsProvider.create();
let completedSegments = 0;
let completedLines = 0;

for (const entry of manifest.segments) {
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
  const originalEvents = structuredClone(segment.events);
  const speechEvents = originalEvents.filter(
    (event): event is Extract<SegmentEvent, { type: 'speech.play' }> =>
      event.type === 'speech.play',
  );
  const timings: SpeechTiming[] = [];

  await Promise.all(
    speechEvents.map(async (event) => {
      const voiceId =
        tts.voiceIds[voiceIndex(event.characterName, tts.voiceIds.length)] ??
        tts.voiceIds[0] ??
        'Daniel';
      const result = await tts.synthesize({
        speechId: event.speechId,
        text: event.subtitle,
        voiceId,
        speakingRate: 1,
        outputDirectory: path.dirname(segmentPath),
      });
      timings.push({
        speechId: event.speechId,
        oldStartMs: event.atMs,
        oldDurationMs: event.durationMs,
        newDurationMs: result.durationMs,
      });
      completedLines += 1;
    }),
  );
  timings.sort((left, right) => left.oldStartMs - right.oldStartMs);

  segment.events = originalEvents.map((event) => {
    const remapped = {
      ...event,
      atMs: remapTime(event.atMs, timings),
    };
    if (event.type !== 'speech.play') {
      return remapped;
    }
    const timing = timings.find((candidate) => candidate.speechId === event.speechId);
    if (timing === undefined) {
      throw new Error(`Missing replacement timing for ${segment.segmentId}/${event.speechId}`);
    }
    return {
      ...remapped,
      voiceId:
        tts.voiceIds[voiceIndex(event.characterName, tts.voiceIds.length)] ??
        tts.voiceIds[0] ??
        'Daniel',
      durationMs: timing.newDurationMs,
    };
  });
  segment.durationMs = remapTime(segment.durationMs, timings);
  segment.suggestedExit = {
    ...segment.suggestedExit,
    earliestMs: remapTime(segment.suggestedExit.earliestMs, timings),
    preferredMs: remapTime(segment.suggestedExit.preferredMs, timings),
  };
  segment.production = {
    ...segment.production,
    generatedAt: new Date().toISOString(),
    model: `${segment.production.model}+${tts.id}`,
  };
  const validated = segmentPackageSchema.parse(segment);
  entry.durationMs = validated.durationMs;
  await writeFile(segmentPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  completedSegments += 1;
  process.stdout.write(
    `${JSON.stringify({ completedSegments, totalSegments: manifest.segments.length, completedLines })}\n`,
  );
}

manifest.generatedAt = new Date().toISOString();
manifest.totalDurationMs = manifest.segments.reduce((total, entry) => total + entry.durationMs, 0);
await writeFile(
  manifestPath,
  `${JSON.stringify(playoutManifestSchema.parse(manifest), null, 2)}\n`,
  'utf8',
);

process.stdout.write(
  `${JSON.stringify(
    {
      provider: tts.id,
      segmentCount: completedSegments,
      speechLineCount: completedLines,
      durationMs: manifest.totalDurationMs,
      segmentsRoot,
    },
    null,
    2,
  )}\n`,
);
