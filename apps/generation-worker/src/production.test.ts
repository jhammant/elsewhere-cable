import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generatedSegmentProposalSchema,
  playoutManifestSchema,
  segmentPackageSchema,
} from '@elsewhere-cable/schemas';
import { demoDraft } from './creative.js';
import {
  produceBatch,
  repairNetworkIdentityCollision,
  semanticNoveltyIssue,
} from './production.js';
import type { LlmProvider, SpeechRequest, SpeechResult, TtsProvider } from './providers.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('produceBatch', () => {
  it('derives a channel name when a provider confuses the network identity for a channel', () => {
    const draft = demoDraft(0);
    draft.channelName = 'Elsewhere Cable';

    const repaired = repairNetworkIdentityCollision(draft);

    expect(repaired.channelName).toBe(`${draft.programmeTitle} Transmission`);
    expect(repaired.programmeTitle).toBe(draft.programmeTitle);
    expect(repaired.premise).toBe(draft.premise);
  });

  it('repairs numbered channels that misuse the network identity', () => {
    const draft = demoDraft(0);
    draft.channelName = 'Elsewhere Cable 8841290';

    expect(repairNetworkIdentityCollision(draft).channelName).toBe(
      `${draft.programmeTitle} Transmission`,
    );
  });

  it('runs bounded generation concurrently and commits one valid manifest', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-batch-'));
    temporaryDirectories.push(outputRoot);
    let active = 0;
    let peakActive = 0;
    let draftIndex = 0;
    let completedGenerations = 0;
    let ttsOverlappedGeneration = false;

    const llm: LlmProvider = {
      id: 'test-llm',
      model: 'test-model',
      async generateStructured() {
        const index = draftIndex;
        draftIndex += 1;
        active += 1;
        peakActive = Math.max(peakActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        completedGenerations += 1;
        return demoDraft(index);
      },
    };
    const tts: TtsProvider = {
      id: 'test-tts',
      synthesize(request: SpeechRequest): Promise<SpeechResult> {
        if (completedGenerations < 4) {
          ttsOverlappedGeneration = true;
        }
        return Promise.resolve({
          audioFile: `audio/${request.speechId}.m4a`,
          durationMs: 1_000,
          provider: 'test-tts',
        });
      },
    };

    const result = await produceBatch({
      count: 4,
      concurrency: 2,
      outputRoot,
      demo: false,
      llm,
      tts,
      embeddingProvider: null,
    });
    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')),
    );

    expect(peakActive).toBe(2);
    expect(ttsOverlappedGeneration).toBe(false);
    expect(result.segmentCount).toBe(4);
    expect(result.concurrency).toBe(2);
    expect(manifest.segments).toHaveLength(4);
    expect(new Set(manifest.segments.map((entry) => entry.segmentId)).size).toBe(4);
    const firstEntry = manifest.segments[0]!;
    const firstSegment = segmentPackageSchema.parse(
      JSON.parse(
        await readFile(path.join(outputRoot, firstEntry.segmentId, 'segment.json'), 'utf8'),
      ),
    );
    expect(firstSegment.visualMedium).toBeDefined();
    expect(firstSegment.castArchetype).toBeDefined();
  });

  it('commits completed novel segments when another batch slot is exhausted', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-partial-batch-'));
    temporaryDirectories.push(outputRoot);
    let requestCount = 0;

    const llm: LlmProvider = {
      id: 'test-llm',
      model: 'test-model',
      generateStructured() {
        requestCount += 1;
        const draft = demoDraft(requestCount);
        if (requestCount <= 6) {
          draft.premise = 'Too short';
        }
        return Promise.resolve(draft);
      },
    };
    const tts: TtsProvider = {
      id: 'test-tts',
      synthesize(request: SpeechRequest): Promise<SpeechResult> {
        return Promise.resolve({
          audioFile: `audio/${request.speechId}.m4a`,
          durationMs: 1_000,
          provider: 'test-tts',
        });
      },
    };

    const result = await produceBatch({
      count: 2,
      concurrency: 1,
      outputRoot,
      demo: false,
      llm,
      tts,
      embeddingProvider: null,
    });
    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')),
    );

    expect(result.requestedSegmentCount).toBe(2);
    expect(result.segmentCount).toBe(1);
    expect(result.rejectedSegmentCount).toBe(1);
    expect(manifest.segments).toHaveLength(1);
  });

  it('screens a premise before requesting its full script', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-two-stage-'));
    temporaryDirectories.push(outputRoot);
    const draft = demoDraft(7);
    let proposalCalls = 0;
    let scriptCalls = 0;
    const llm: LlmProvider = {
      id: 'two-stage-test-llm',
      model: 'test-model',
      generateProposal() {
        proposalCalls += 1;
        return Promise.resolve(generatedSegmentProposalSchema.parse(draft));
      },
      generateStructured() {
        scriptCalls += 1;
        return Promise.resolve(draft);
      },
    };
    const tts: TtsProvider = {
      id: 'test-tts',
      synthesize(request: SpeechRequest): Promise<SpeechResult> {
        return Promise.resolve({
          audioFile: `audio/${request.speechId}.m4a`,
          durationMs: 1_000,
          provider: 'test-tts',
        });
      },
    };

    const result = await produceBatch({
      count: 1,
      concurrency: 1,
      outputRoot,
      demo: false,
      llm,
      tts,
      embeddingProvider: null,
    });

    expect(proposalCalls).toBe(1);
    expect(scriptCalls).toBe(1);
    expect(result.segmentCount).toBe(1);
  });

  it('prepares dialogue with bounded TTS endpoint parallelism', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-parallel-tts-'));
    temporaryDirectories.push(outputRoot);
    let active = 0;
    let peakActive = 0;
    const tts: TtsProvider = {
      id: 'parallel-test-tts',
      parallelism: 2,
      async synthesize(request: SpeechRequest): Promise<SpeechResult> {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return {
          audioFile: `audio/${request.speechId}.m4a`,
          durationMs: 1_000,
          provider: 'parallel-test-tts',
        };
      },
    };

    await produceBatch({
      count: 1,
      concurrency: 1,
      outputRoot,
      demo: true,
      llm: null,
      tts,
      embeddingProvider: null,
    });

    expect(peakActive).toBe(2);
  });

  it('rejects a semantically repeated premise even when the wording changes', () => {
    const issue = semanticNoveltyIssue(
      'Breakfast adds weight to your spirit.',
      [0.99, 0.01, 0],
      [
        {
          title: 'Heavy Breakfast',
          premise: 'A cereal makes your soul physically heavy.',
          dialogue: [],
        },
      ],
      [[1, 0, 0]],
    );

    expect(issue).toContain('semantically repeats');
  });
});
