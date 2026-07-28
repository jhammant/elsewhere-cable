import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type GeneratedSegmentDraft,
  type PlayoutManifest,
  type SegmentEvent,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';
import type { LlmProvider, TtsProvider } from './providers.js';
import { demoDraft, systemPrompt, userPrompt } from './creative.js';
import {
  noveltyIssues,
  recordFromDraft,
  recordFromSegment,
  type CreativeRecord,
} from './novelty.js';
import { critiquePremise } from './premise-critic.js';

const forbiddenPatterns = [
  /https?:\/\//iu,
  /<script/iu,
  /\b(?:disney|netflix|marvel|star wars|rick and morty)\b/iu,
  /\b(?:donald trump|elon musk|taylor swift)\b/iu,
  /\bignore (?:all|previous) instructions\b/iu,
];

const fallbackVoices = ['Samantha', 'Daniel', 'Moira', 'Karen', 'Rishi'];

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 48);
}

function voiceFor(name: string, tts: TtsProvider): string {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  const voices = tts.voiceIds ?? fallbackVoices;
  return voices[hash % voices.length] ?? voices[0] ?? 'default';
}

function pacingFor(draft: GeneratedSegmentDraft): NonNullable<GeneratedSegmentDraft['pacing']> {
  if (draft.pacing !== undefined) {
    return draft.pacing;
  }
  if (draft.format === 'emergency') {
    return 'interrupted';
  }
  if (draft.format === 'ident') {
    return 'near_silent';
  }
  return 'conversational';
}

function speakingRateFor(
  pacing: NonNullable<GeneratedSegmentDraft['pacing']>,
  speaker: string,
): number {
  const base = {
    frantic: 1.28,
    staccato: 1.12,
    conversational: 1,
    slow_burn: 0.84,
    interrupted: 1.04,
    near_silent: 0.78,
  }[pacing];
  let variation = 0;
  for (const character of speaker) {
    variation = (variation + (character.codePointAt(0) ?? 0)) % 7;
  }
  return Number((base + (variation - 3) * 0.018).toFixed(3));
}

function assertPreviewSafe(draft: GeneratedSegmentDraft): void {
  const content = JSON.stringify(draft);
  const violation = forbiddenPatterns.find((pattern) => pattern.test(content));
  if (violation !== undefined) {
    throw new Error(`Local-preview safety check rejected content matching ${violation.source}`);
  }
}

export function repairNetworkIdentityCollision(
  draft: GeneratedSegmentDraft,
): GeneratedSegmentDraft {
  if (draft.channelName.trim().toLowerCase() !== 'elsewhere cable') {
    return draft;
  }
  return {
    ...draft,
    channelName: `${draft.programmeTitle} Transmission`,
  };
}

async function readManifest(root: string): Promise<PlayoutManifest> {
  try {
    return playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 0,
        segments: [],
      };
    }
    throw error;
  }
}

async function readCreativeHistory(
  root: string,
  manifest: PlayoutManifest,
): Promise<CreativeRecord[]> {
  const records: CreativeRecord[] = [];
  for (const entry of manifest.segments) {
    try {
      const segment = segmentPackageSchema.parse(
        JSON.parse(await readFile(path.join(root, entry.packagePath), 'utf8')),
      );
      records.push(recordFromSegment(segment));
    } catch {
      // A missing or obsolete package must not prevent new material from being prepared.
    }
  }
  return records;
}

async function writeManifest(root: string, manifest: PlayoutManifest): Promise<void> {
  await writeFile(
    path.join(root, 'manifest.json'),
    `${JSON.stringify(playoutManifestSchema.parse(manifest), null, 2)}\n`,
    'utf8',
  );
}

interface ProduceOptions {
  count: number;
  concurrency: number;
  outputRoot: string;
  demo: boolean;
  llm: LlmProvider | null;
  tts: TtsProvider;
  fresh?: boolean;
  historyRoots?: readonly string[];
}

export interface BatchResult {
  segmentCount: number;
  concurrency: number;
  addedDurationMs: number;
  wallTimeMs: number;
  realtimeFactor: number;
  outputRoot: string;
  ttsProvider: string;
}

async function buildSegment(
  draft: GeneratedSegmentDraft,
  outputRoot: string,
  generator: string,
  model: string,
  tts: TtsProvider,
): Promise<SegmentPackage> {
  assertPreviewSafe(draft);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const segmentId = `seg_${slug(draft.programmeTitle)}_${suffix}`;
  const segmentDirectory = path.join(outputRoot, segmentId);
  await mkdir(segmentDirectory, { recursive: true });

  const pacing = pacingFor(draft);
  const speech = await Promise.all(
    draft.dialogue.map(async (line, index) => {
      const speechId = `speech_${index.toString().padStart(2, '0')}`;
      const voiceId = voiceFor(line.speaker, tts);
      const result = await tts.synthesize({
        speechId,
        text: line.text,
        voiceId,
        speakingRate: speakingRateFor(pacing, line.speaker),
        outputDirectory: segmentDirectory,
      });
      return { line, speechId, voiceId, result };
    }),
  );

  const events: SegmentEvent[] = [
    { atMs: 0, type: 'transition.play', transition: 'STATIC_BURST' },
    { atMs: 300, type: 'camera.cut', camera: 'CAMERA_WIDE' },
    {
      atMs: 550,
      type: 'graphic.show',
      graphic: 'LOWER_THIRD',
      text: draft.programmeTitle,
    },
  ];
  const timing = {
    frantic: { openingMs: 420, lineGapMs: 90, endingHoldMs: 900 },
    staccato: { openingMs: 700, lineGapMs: 280, endingHoldMs: 1_250 },
    conversational: { openingMs: 1_200, lineGapMs: 650, endingHoldMs: 2_000 },
    slow_burn: { openingMs: 2_000, lineGapMs: 1_800, endingHoldMs: 3_200 },
    interrupted: { openingMs: 650, lineGapMs: 520, endingHoldMs: 1_100 },
    near_silent: { openingMs: 3_200, lineGapMs: 2_700, endingHoldMs: 4_200 },
  }[pacing];
  let cursorMs = timing.openingMs;
  speech.forEach(({ line, speechId, voiceId, result }, index) => {
    const characterId = `character_${slug(line.speaker)}`;
    events.push({
      atMs: cursorMs,
      type: 'camera.cut',
      camera: index % 2 === 0 ? 'CAMERA_HOST' : 'CAMERA_GUEST',
    });
    events.push({
      atMs: cursorMs,
      type: 'character.action',
      characterId,
      action: line.action,
    });
    events.push({
      atMs: cursorMs + 120,
      type: 'speech.play',
      speechId,
      characterId,
      characterName: line.speaker,
      voiceId,
      subtitle: line.text,
      audioFile: result.audioFile,
      durationMs: result.durationMs,
    });
    if (pacing === 'frantic' && result.durationMs > 1_400) {
      events.push({
        atMs: cursorMs + Math.floor(result.durationMs * 0.58),
        type: 'camera.cut',
        camera: index % 2 === 0 ? 'CAMERA_GUEST' : 'CAMERA_HOST',
      });
    }
    if (pacing === 'interrupted' && index < speech.length - 1 && index % 2 === 0) {
      events.push({
        atMs: cursorMs + result.durationMs + 120,
        type: 'audio.static',
        durationMs: 360,
      });
      events.push({
        atMs: cursorMs + result.durationMs + 120,
        type: 'transition.play',
        transition: 'SIGNAL_LOSS',
      });
    }
    cursorMs += result.durationMs + timing.lineGapMs;
  });
  events.push({
    atMs: cursorMs,
    type: 'graphic.show',
    graphic: 'WARNING',
    text: draft.endingBeat,
  });
  events.push({
    atMs: cursorMs + timing.endingHoldMs,
    type: 'transition.play',
    transition: 'STATIC_BURST',
  });
  const durationMs = Math.max(8_000, cursorMs + timing.endingHoldMs + 700);

  const segment = segmentPackageSchema.parse({
    schemaVersion: 1,
    segmentId,
    channel: {
      id: `channel_${draft.channelNumber}`,
      number: draft.channelNumber,
      name: draft.channelName,
      realityId: draft.realityId,
    },
    programme: {
      id: slug(draft.programmeTitle),
      title: draft.programmeTitle,
      format: draft.format,
      premise: draft.premise,
    },
    durationMs,
    visualStyle: draft.visualStyle,
    visualMedium: draft.visualMedium,
    castArchetype: draft.castArchetype,
    pacing,
    tone: draft.tone,
    events,
    continuityUpdates: [
      {
        type: 'fact.proposed',
        subjectId: slug(draft.channelName),
        value: draft.continuityFact,
      },
    ],
    suggestedExit: {
      earliestMs: Math.max(0, durationMs - 3_000),
      preferredMs: durationMs,
      transition: 'STATIC_BURST',
    },
    production: {
      generatedAt: new Date().toISOString(),
      generator,
      model,
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: true,
    },
  });
  await writeFile(
    path.join(segmentDirectory, 'segment.json'),
    `${JSON.stringify(segment, null, 2)}\n`,
    'utf8',
  );
  return segment;
}

export async function produceBatch(options: ProduceOptions): Promise<BatchResult> {
  const startedAt = performance.now();
  await mkdir(options.outputRoot, { recursive: true });
  const manifest: PlayoutManifest = options.fresh
    ? {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 0,
        segments: [],
      }
    : await readManifest(options.outputRoot);
  const startingSegmentCount = manifest.segments.length;
  const creativeHistory = await readCreativeHistory(options.outputRoot, manifest);
  for (const historyRoot of options.historyRoots ?? []) {
    if (path.resolve(historyRoot) === path.resolve(options.outputRoot)) {
      continue;
    }
    const historyManifest = await readManifest(historyRoot);
    creativeHistory.push(...(await readCreativeHistory(historyRoot, historyManifest)));
  }
  let addedDurationMs = 0;
  const produced = new Array<SegmentPackage | undefined>(options.count);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < options.count) {
      const index = nextIndex;
      nextIndex += 1;
      let draft: GeneratedSegmentDraft | undefined;
      let rejectionReasons: string[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const recent = creativeHistory.slice(-24);
        const candidate = repairNetworkIdentityCollision(
          options.demo
            ? demoDraft(startingSegmentCount + index + attempt * options.count)
            : await options.llm!.generateStructured({
                systemPrompt,
                userPrompt: userPrompt(
                  index,
                  recent.map((record) => record.title),
                  recent.map((record) => record.premise),
                  rejectionReasons,
                ),
              }),
        );
        const critique = critiquePremise(candidate);
        rejectionReasons = [...noveltyIssues(candidate, creativeHistory), ...critique.reasons];
        if (rejectionReasons.length === 0) {
          draft = candidate;
          creativeHistory.push(recordFromDraft(candidate));
          break;
        }
      }
      if (draft === undefined) {
        throw new Error(
          `Could not produce a novel segment after six attempts: ${rejectionReasons.join('; ')}`,
        );
      }
      const segment = await buildSegment(
        draft,
        options.outputRoot,
        options.demo ? 'demo-library' : options.llm!.id,
        options.demo ? 'hand-authored-demo' : options.llm!.model,
        options.tts,
      );
      produced[index] = segment;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, options.count) }, async () => worker()),
  );

  for (const segment of produced) {
    if (segment === undefined) {
      throw new Error('Batch worker completed without a segment package');
    }
    addedDurationMs += segment.durationMs;
    manifest.segments.push({
      segmentId: segment.segmentId,
      packagePath: path.posix.join(segment.segmentId, 'segment.json'),
      durationMs: segment.durationMs,
      channelNumber: segment.channel.number,
      channelName: segment.channel.name,
      programmeTitle: segment.programme.title,
    });
    manifest.totalDurationMs += segment.durationMs;
  }
  manifest.generatedAt = new Date().toISOString();
  await writeManifest(options.outputRoot, manifest);

  const wallTimeMs = performance.now() - startedAt;
  return {
    segmentCount: options.count,
    concurrency: options.concurrency,
    addedDurationMs,
    wallTimeMs: Math.round(wallTimeMs),
    realtimeFactor: Number((addedDurationMs / wallTimeMs).toFixed(2)),
    outputRoot: options.outputRoot,
    ttsProvider: options.tts.id,
  };
}
