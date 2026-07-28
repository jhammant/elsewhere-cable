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

const forbiddenPatterns = [
  /https?:\/\//iu,
  /<script/iu,
  /\b(?:disney|netflix|marvel|star wars|rick and morty)\b/iu,
  /\b(?:donald trump|elon musk|taylor swift)\b/iu,
  /\bignore (?:all|previous) instructions\b/iu,
];

const voices = ['Samantha', 'Daniel', 'Moira', 'Karen', 'Rishi'];

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 48);
}

function voiceFor(name: string): string {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return voices[hash % voices.length] ?? 'Samantha';
}

function assertPreviewSafe(draft: GeneratedSegmentDraft): void {
  const content = JSON.stringify(draft);
  const violation = forbiddenPatterns.find((pattern) => pattern.test(content));
  if (violation !== undefined) {
    throw new Error(`Local-preview safety check rejected content matching ${violation.source}`);
  }
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

  const speech = await Promise.all(
    draft.dialogue.map(async (line, index) => {
      const speechId = `speech_${index.toString().padStart(2, '0')}`;
      const voiceId = voiceFor(line.speaker);
      const result = await tts.synthesize({
        speechId,
        text: line.text,
        voiceId,
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
  let cursorMs = 1_200;
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
    cursorMs += result.durationMs + 650;
  });
  events.push({
    atMs: cursorMs,
    type: 'graphic.show',
    graphic: 'WARNING',
    text: draft.endingBeat,
  });
  events.push({
    atMs: cursorMs + 2_000,
    type: 'transition.play',
    transition: 'STATIC_BURST',
  });
  const durationMs = Math.max(8_000, cursorMs + 2_700);

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
  const manifest = await readManifest(options.outputRoot);
  const startingSegmentCount = manifest.segments.length;
  const recentTitles = manifest.segments.slice(-12).map((entry) => entry.programmeTitle);
  let addedDurationMs = 0;
  const produced = new Array<SegmentPackage | undefined>(options.count);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < options.count) {
      const index = nextIndex;
      nextIndex += 1;
      const draft = options.demo
        ? demoDraft(startingSegmentCount + index)
        : await options.llm!.generateStructured({
            systemPrompt,
            userPrompt: userPrompt(index, recentTitles),
          });
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
