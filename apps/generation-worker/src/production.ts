import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generatedSegmentProposalSchema,
  playoutManifestSchema,
  segmentPackageSchema,
  type GeneratedSegmentDraft,
  type GeneratedSegmentProposal,
  type OptimisationBrief,
  type PlayoutManifest,
  type SegmentEvent,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';
import type { EmbeddingProvider, LlmProvider, TtsProvider } from './providers.js';
import {
  demoDraft,
  proposalSystemPrompt,
  scriptPrompt,
  systemPrompt,
  userPrompt,
} from './creative.js';
import { containsSpokenStageDirection } from './dialogue-quality.js';
import {
  conceptNoveltyIssues,
  dialogueNoveltyIssues,
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
  /\b(?:chok(?:e|es|ed|ing)|strangl(?:e|es|ed|ing)|suffocat(?:e|es|ed|ing)|windpipe|decapitat(?:e|es|ed|ing)|dismember(?:s|ed|ing)?|drops?\s+dead|dropped\s+dead)\b/iu,
  /\b(?:bleed(?:s|ing)?|blood(?:y)?|chew(?:s|ed|ing)?\s+through|crush(?:es|ed|ing)?\s+(?:a\s+)?(?:throat|vocal cords?|bones?|body))\b/iu,
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

function onScreenText(value: string, maximumLength = 180): string {
  if (value.length <= maximumLength) {
    return value;
  }
  const candidate = value.slice(0, maximumLength - 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const boundary = lastSpace >= maximumLength * 0.7 ? lastSpace : candidate.length;
  return `${candidate.slice(0, boundary).trimEnd()}…`;
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

export function assertPreviewSafe(draft: GeneratedSegmentDraft): void {
  const content = JSON.stringify(draft);
  const violation = forbiddenPatterns.find((pattern) => pattern.test(content));
  if (violation !== undefined) {
    throw new Error(`Local-preview safety check rejected content matching ${violation.source}`);
  }
  if (draft.dialogue.some((line) => containsSpokenStageDirection(line.text))) {
    throw new Error(
      'Local-preview quality check rejected a spoken stage direction; physical performance belongs in action',
    );
  }
}

export function repairNetworkIdentityCollision<
  T extends { channelName: string; programmeTitle: string },
>(draft: T): T {
  if (!/^elsewhere cable\b/iu.test(draft.channelName.trim())) {
    return draft;
  }
  return {
    ...draft,
    channelName: `${draft.programmeTitle} Transmission`,
  };
}

function proposalQualityIssues(proposal: GeneratedSegmentProposal): string[] {
  const issues: string[] = [];
  const premiseWordCount = proposal.premise.trim().split(/\s+/u).filter(Boolean).length;
  if (premiseWordCount < 7 || premiseWordCount > 38) {
    issues.push('premise must state one legible comic rule in 7–38 words');
  }
  if (/\b(?:random|wacky|nonsense|for no reason|anything can happen)\b/iu.test(proposal.premise)) {
    issues.push('proposal describes randomness instead of a consistent comic mechanism');
  }
  return issues;
}

function proposalPreservationIssues(
  proposal: GeneratedSegmentProposal,
  draft: GeneratedSegmentDraft,
): string[] {
  const scriptedProposal = generatedSegmentProposalSchema.parse(draft);
  return JSON.stringify(scriptedProposal) === JSON.stringify(proposal)
    ? []
    : ['script changed approved proposal metadata'];
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
  embeddingProvider: EmbeddingProvider | null;
  fresh?: boolean;
  historyRoots?: readonly string[];
  optimisationBrief?: OptimisationBrief | null;
}

// Premises deliberately reuse television formats and physical sets. Lower thresholds mostly
// measure that shared scenery rather than a repeated comic mechanism. Lexical shingles separately
// reject exact and near-exact wording, while this higher semantic threshold catches paraphrased
// versions of the same joke without exhausting a set after one appearance.
const semanticSimilarityLimit = 0.84;

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function semanticNoveltyIssue(
  premise: string,
  embedding: readonly number[],
  history: readonly CreativeRecord[],
  historyEmbeddings: readonly (readonly number[])[],
): string | null {
  let closestIndex = -1;
  let closestSimilarity = -1;
  for (let index = 0; index < historyEmbeddings.length; index += 1) {
    const similarity = cosineSimilarity(embedding, historyEmbeddings[index] ?? []);
    if (similarity > closestSimilarity) {
      closestSimilarity = similarity;
      closestIndex = index;
    }
  }
  if (closestSimilarity < semanticSimilarityLimit || closestIndex < 0) {
    return null;
  }
  return `premise semantically repeats "${history[closestIndex]?.premise ?? premise}" (${closestSimilarity.toFixed(3)})`;
}

export interface BatchResult {
  requestedSegmentCount: number;
  segmentCount: number;
  rejectedSegmentCount: number;
  concurrency: number;
  addedDurationMs: number;
  wallTimeMs: number;
  realtimeFactor: number;
  rejectionReasons: string[];
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

  try {
    const pacing = pacingFor(draft);
    const speech = new Array<{
      line: GeneratedSegmentDraft['dialogue'][number];
      speechId: string;
      voiceId: string;
      result: Awaited<ReturnType<TtsProvider['synthesize']>>;
    }>(draft.dialogue.length);
    let nextSpeechIndex = 0;
    const speechWorker = async (): Promise<void> => {
      while (nextSpeechIndex < draft.dialogue.length) {
        const index = nextSpeechIndex;
        nextSpeechIndex += 1;
        const line = draft.dialogue[index]!;
        const speechId = `speech_${index.toString().padStart(2, '0')}`;
        const voiceId = voiceFor(line.speaker, tts);
        const result = await tts.synthesize({
          speechId,
          text: line.text,
          voiceId,
          speakingRate: speakingRateFor(pacing, line.speaker),
          outputDirectory: segmentDirectory,
        });
        speech[index] = { line, speechId, voiceId, result };
      }
    };
    const speechWorkerResults = await Promise.allSettled(
      Array.from(
        {
          length: Math.min(Math.max(1, tts.parallelism ?? 1), draft.dialogue.length),
        },
        async () => speechWorker(),
      ),
    );
    const failedSpeechWorker = speechWorkerResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failedSpeechWorker !== undefined) {
      throw failedSpeechWorker.reason;
    }

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
      text: onScreenText(draft.endingBeat),
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
  } catch (error) {
    await rm(segmentDirectory, { recursive: true, force: true });
    throw error;
  }
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
  const creativeSerialBase = options.demo
    ? startingSegmentCount
    : Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 8), 16);
  const creativeHistory = await readCreativeHistory(options.outputRoot, manifest);
  for (const historyRoot of options.historyRoots ?? []) {
    if (path.resolve(historyRoot) === path.resolve(options.outputRoot)) {
      continue;
    }
    const historyManifest = await readManifest(historyRoot);
    creativeHistory.push(...(await readCreativeHistory(historyRoot, historyManifest)));
  }
  const semanticHistory =
    options.embeddingProvider === null
      ? []
      : await options.embeddingProvider.embed(creativeHistory.map((record) => record.premise));
  let addedDurationMs = 0;
  const proposals = new Array<GeneratedSegmentProposal | undefined>(options.count);
  const reservedRecords = new Array<CreativeRecord | undefined>(options.count);
  const drafts = new Array<GeneratedSegmentDraft | undefined>(options.count);
  const produced = new Array<SegmentPackage | undefined>(options.count);
  const failures = new Array<string | undefined>(options.count);
  let nextIndex = 0;
  let noveltyGate = Promise.resolve();
  const withNoveltyGate = async <T>(operation: () => T): Promise<T> => {
    const previous = noveltyGate;
    let release = (): void => undefined;
    noveltyGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return operation();
    } finally {
      release();
    }
  };

  const worker = async (): Promise<void> => {
    while (nextIndex < options.count) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        let rejectionReasons: string[] = [];
        const maximumProposalAttempts = 10;
        for (let attempt = 0; attempt < maximumProposalAttempts; attempt += 1) {
          const recent = creativeHistory.slice(-24);
          const prompt = userPrompt(
            creativeSerialBase + index + attempt * options.count,
            recent.map((record) => record.title),
            recent.map((record) => record.premise),
            rejectionReasons,
            options.optimisationBrief ?? null,
          );
          const useProposalStage = !options.demo && options.llm!.generateProposal !== undefined;
          const generated = repairNetworkIdentityCollision(
            options.demo
              ? demoDraft(startingSegmentCount + index + attempt * options.count)
              : useProposalStage
                ? await options.llm!.generateProposal!({
                    systemPrompt: proposalSystemPrompt,
                    userPrompt: prompt,
                  })
                : await options.llm!.generateStructured({
                    systemPrompt,
                    userPrompt: prompt,
                  }),
          );
          const candidateEmbedding =
            options.embeddingProvider === null
              ? null
              : (await options.embeddingProvider.embed([generated.premise]))[0];
          const accepted = await withNoveltyGate(() => {
            const semanticIssue =
              candidateEmbedding === null || candidateEmbedding === undefined
                ? null
                : semanticNoveltyIssue(
                    generated.premise,
                    candidateEmbedding,
                    creativeHistory,
                    semanticHistory,
                  );
            rejectionReasons = [
              ...conceptNoveltyIssues(generated, creativeHistory),
              ...(semanticIssue === null ? [] : [semanticIssue]),
              ...(useProposalStage
                ? proposalQualityIssues(generated)
                : [
                    ...dialogueNoveltyIssues(
                      (generated as GeneratedSegmentDraft).dialogue,
                      creativeHistory,
                    ),
                    ...critiquePremise(generated as GeneratedSegmentDraft).reasons,
                  ]),
            ];
            if (rejectionReasons.length !== 0) {
              return false;
            }
            const record: CreativeRecord = {
              title: generated.programmeTitle,
              premise: generated.premise,
              dialogue: useProposalStage
                ? []
                : (generated as GeneratedSegmentDraft).dialogue.map((line) => line.text),
            };
            creativeHistory.push(record);
            reservedRecords[index] = record;
            if (candidateEmbedding !== null && candidateEmbedding !== undefined) {
              semanticHistory.push(candidateEmbedding);
            }
            if (useProposalStage) {
              proposals[index] = generated;
            } else {
              drafts[index] = generated as GeneratedSegmentDraft;
            }
            return true;
          });
          if (accepted) {
            break;
          }
        }
        if (proposals[index] === undefined && drafts[index] === undefined) {
          throw new Error(
            `Could not produce a novel premise after ${maximumProposalAttempts} attempts: ${rejectionReasons.join('; ')}`,
          );
        }
      } catch (error) {
        failures[index] = error instanceof Error ? error.message : String(error);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, options.count) }, async () => worker()),
  );

  let nextScriptIndex = 0;
  const scriptWorker = async (): Promise<void> => {
    while (nextScriptIndex < proposals.length) {
      const index = nextScriptIndex;
      nextScriptIndex += 1;
      const proposal = proposals[index];
      if (proposal === undefined) {
        continue;
      }
      let rejectionReasons: string[] = [];
      const maximumScriptAttempts = 2;
      for (let attempt = 0; attempt < maximumScriptAttempts; attempt += 1) {
        try {
          const scripted = await options.llm!.generateStructured({
            systemPrompt,
            userPrompt: scriptPrompt(proposal, rejectionReasons),
          });
          const candidate = repairNetworkIdentityCollision({
            ...scripted,
            ...proposal,
            dialogue: scripted.dialogue,
          });
          rejectionReasons = [
            ...proposalPreservationIssues(proposal, candidate),
            ...dialogueNoveltyIssues(candidate.dialogue, creativeHistory),
            ...critiquePremise(candidate).reasons,
          ];
          if (rejectionReasons.length === 0) {
            drafts[index] = candidate;
            const record = reservedRecords[index];
            if (record !== undefined) {
              record.dialogue = candidate.dialogue.map((line) => line.text);
            }
            break;
          }
        } catch (error) {
          rejectionReasons = [error instanceof Error ? error.message : String(error)];
        }
      }
      if (drafts[index] === undefined) {
        failures[index] =
          `Could not script approved premise after ${maximumScriptAttempts} attempts: ${rejectionReasons.join('; ')}`;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, options.count) }, async () =>
      scriptWorker(),
    ),
  );

  let nextProductionIndex = 0;
  const productionWorker = async (): Promise<void> => {
    while (nextProductionIndex < drafts.length) {
      const index = nextProductionIndex;
      nextProductionIndex += 1;
      const draft = drafts[index];
      if (draft === undefined) {
        continue;
      }
      try {
        produced[index] = await buildSegment(
          draft,
          options.outputRoot,
          options.demo ? 'demo-library' : options.llm!.id,
          options.demo ? 'hand-authored-demo' : options.llm!.model,
          options.tts,
        );
      } catch (error) {
        failures[index] = error instanceof Error ? error.message : String(error);
      }
    }
  };
  await productionWorker();

  const completedSegments = produced.filter(
    (segment): segment is SegmentPackage => segment !== undefined,
  );
  if (completedSegments.length === 0) {
    const reasons = failures.filter((failure): failure is string => failure !== undefined);
    throw new Error(
      `Batch produced no approved segment packages${reasons.length === 0 ? '' : `: ${reasons.join(' | ')}`}`,
    );
  }

  for (const segment of completedSegments) {
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
    requestedSegmentCount: options.count,
    segmentCount: completedSegments.length,
    rejectedSegmentCount: options.count - completedSegments.length,
    concurrency: options.concurrency,
    addedDurationMs,
    wallTimeMs: Math.round(wallTimeMs),
    realtimeFactor: Number((addedDurationMs / wallTimeMs).toFixed(2)),
    rejectionReasons: failures.filter((failure): failure is string => failure !== undefined),
    outputRoot: options.outputRoot,
    ttsProvider: options.tts.id,
  };
}
