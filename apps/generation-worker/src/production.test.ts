import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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
  assertPreviewSafe,
  editorialCritiqueIssues,
  produceBatch,
  proposalQualityIssues,
  repairNetworkIdentityCollision,
  semanticNoveltyIssue,
} from './production.js';
import type { LlmProvider, SpeechRequest, SpeechResult, TtsProvider } from './providers.js';

const temporaryDirectories: string[] = [];

function universallyAlignedProposal(draft: ReturnType<typeof demoDraft>) {
  const premise =
    draft.channelNumber % 2 === 0
      ? 'During an emergency news programme, a refrigerator wants a worker to offer its service, but the family customer refuses permission until a spoken contract transfers status and the studio camera moves.'
      : "At a live community workplace channel, a worker's meeting minutes want to sell a news product, yet the customer refuses social permission; an emergency spoken contract reassigns rank whenever the studio camera rotates.";
  return generatedSegmentProposalSchema.parse({
    ...draft,
    premise,
    endingBeat: 'The customer signs the contract as the camera holds on the product.',
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('produceBatch', () => {
  it('requires the editorial critic to approve coherent, earned comedy', () => {
    expect(
      editorialCritiqueIssues({
        accepted: true,
        coherence: 8,
        comedyEscalation: 7,
        dialogueNaturalness: 8,
        endingEarned: 8,
        issues: [],
      }),
    ).toEqual([]);
    expect(
      editorialCritiqueIssues({
        accepted: false,
        coherence: 4,
        comedyEscalation: 5,
        dialogueNaturalness: 3,
        endingEarned: 2,
        issues: ['The final line narrates an unearned transformation.'],
      }),
    ).toEqual(['editorial critic: The final line narrates an unearned transformation.']);
  });

  it('rejects a surreal mechanism that has no explicit character goal', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...demoDraft(0),
      channelName: 'Channel 82910473',
      pacing: undefined,
      premise:
        'Inside a laundrette, every laundry basket grows another corner whenever the service bell rings. (14 words)',
    });

    expect(proposalQualityIssues(proposal)).toEqual(
      expect.arrayContaining([
        'premise must make a specific character goal or refusal explicit',
        'proposal must specify the assigned pacing mode',
        'channel needs a memorable fictional identity, not its number as a name',
        'proposal contains a model annotation instead of programme content',
      ]),
    );
  });

  it('rejects a proposal whose ending invents unrelated story physics', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...demoDraft(0),
      endingBeat: 'The committee chair suddenly transforms into a municipal staircase.',
    });

    expect(proposalQualityIssues(proposal)).toEqual(
      expect.arrayContaining([expect.stringContaining('unearned mechanisms')]),
    );
  });

  it('requires a stageable physical setting at the start of every premise', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      premise:
        'A host wants to sell a service package, but the customer refuses because its receipt claims decision authority.',
    });

    expect(proposalQualityIssues(proposal)).toContain(
      'premise must begin with the physical setting so the renderer can stage it',
    );
  });

  it('rejects realistic catastrophe stakes and alarm-style titles from emergency comedy', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      format: 'emergency',
      programmeTitle: 'URGENT EVACUATION ALERT',
      storyMode: 'service_mismatch',
      premise:
        'During an emergency service bulletin, an official wants a customer to evacuate before a star system collapses, but the customer refuses.',
      endingBeat: 'The official grants the customer a delayed service appointment.',
    });

    expect(proposalQualityIssues(proposal)).toEqual(
      expect.arrayContaining([
        'programme title must use readable title case rather than all capitals',
        'emergency fragments must concern harmless fictional administrative stakes',
      ]),
    );
  });

  it('rejects an ending that invents an accidental second mechanism', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      endingBeat: 'The host accidentally activates another contract beneath the product.',
    });

    expect(proposalQualityIssues(proposal)).toContain(
      'ending introduces an unearned second object or mechanism',
    );
  });

  it('rejects cruel or graphic harm before preparing speech', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = 'The harness is choking the contestant until they drop dead.';

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('rejects bereavement and bodily harm as shortcuts for comedy stakes', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = "My cat's passing left the body still warm.";

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('does not mistake a committee chair for an object with agency', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      format: 'public_access',
      storyMode: 'object_agency',
      premise:
        "At a community advice desk, the committee chair wants a resident's pen to sign a ruling while the resident refuses to surrender it.",
    });

    expect(proposalQualityIssues(proposal)).toContain(
      'object-agency premise must give the object its own explicit demand or refusal',
    );
  });

  it('rejects bracketed stage directions before preparing speech', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = '(Points at the staircase while the camera zooms)';

    expect(() => assertPreviewSafe(draft)).toThrow('spoken stage direction');
  });

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
    let activeTts = 0;
    let peakActiveTts = 0;

    const llm: LlmProvider = {
      id: 'test-llm',
      model: 'test-model',
      async generateStructured(request) {
        const index = draftIndex;
        draftIndex += 1;
        active += 1;
        peakActive = Math.max(peakActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        completedGenerations += 1;
        const draft = demoDraft(index);
        const pacing = request.userPrompt.match(/- Pacing: ([a-z_]+)\./u)?.[1] ?? 'conversational';
        const dialogueCount =
          {
            frantic: 10,
            staccato: 8,
            conversational: 6,
            slow_burn: 6,
            interrupted: 4,
            near_silent: 4,
          }[pacing] ?? 6;
        draft.dialogue = Array.from({ length: dialogueCount }, (_, dialogueIndex) => ({
          ...draft.dialogue[dialogueIndex % draft.dialogue.length]!,
          text: `${draft.dialogue[dialogueIndex % draft.dialogue.length]!.text} Beat ${
            dialogueIndex + 1
          }.`,
        }));
        draft.endingBeat =
          'The final compliance notice continues past the available broadcast-safe graphic area because the committee has mistaken length for authority. '.repeat(
            2,
          );
        return draft;
      },
    };
    const tts: TtsProvider = {
      id: 'test-tts',
      parallelism: 2,
      async synthesize(request: SpeechRequest): Promise<SpeechResult> {
        if (completedGenerations < 4) {
          ttsOverlappedGeneration = true;
        }
        activeTts += 1;
        peakActiveTts = Math.max(peakActiveTts, activeTts);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeTts -= 1;
        return {
          audioFile: `audio/${request.speechId}.m4a`,
          durationMs: 1_000,
          provider: 'test-tts',
        };
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
    expect(peakActiveTts).toBe(2);
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
    const endingGraphic = firstSegment.events.find(
      (event) => event.type === 'graphic.show' && event.graphic === 'WARNING',
    );
    expect(endingGraphic).toBeUndefined();
    const lastSpeech = firstSegment.events.filter((event) => event.type === 'speech.play').at(-1);
    const payoffAction = firstSegment.events
      .filter((event) => event.type === 'character.action')
      .at(-1);
    expect(payoffAction?.atMs).toBeGreaterThanOrEqual(
      lastSpeech?.type === 'speech.play' ? lastSpeech.atMs + lastSpeech.durationMs : 0,
    );
    expect(payoffAction?.type).toBe('character.action');
    expect(['IDLE', 'PAUSE', 'FREEZE']).not.toContain(
      payoffAction?.type === 'character.action' ? payoffAction.action : null,
    );
  });

  it('preserves manifest entries published while a batch is being produced', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-concurrent-manifest-'));
    temporaryDirectories.push(outputRoot);
    let releaseSpeech = (): void => undefined;
    const speechReleased = new Promise<void>((resolve) => {
      releaseSpeech = resolve;
    });
    let signalSpeechStarted = (): void => undefined;
    const speechStarted = new Promise<void>((resolve) => {
      signalSpeechStarted = resolve;
    });
    let firstSpeech = true;
    const tts: TtsProvider = {
      id: 'controlled-test-tts',
      async synthesize(request: SpeechRequest): Promise<SpeechResult> {
        if (firstSpeech) {
          firstSpeech = false;
          signalSpeechStarted();
          await speechReleased;
        }
        return {
          audioFile: `audio/${request.speechId}.m4a`,
          durationMs: 1_000,
          provider: 'controlled-test-tts',
        };
      },
    };
    const production = produceBatch({
      count: 1,
      concurrency: 1,
      outputRoot,
      demo: true,
      llm: null,
      tts,
      embeddingProvider: null,
    });
    await speechStarted;
    await writeFile(
      path.join(outputRoot, 'manifest.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 1_234,
        segments: [
          {
            segmentId: 'seg_external_recovery',
            packagePath: 'seg_external_recovery/segment.json',
            durationMs: 1_234,
            channelNumber: 999_999_999,
            channelName: 'External Recovery',
            programmeTitle: 'External Recovery Programme',
          },
        ],
      })}\n`,
      'utf8',
    );
    releaseSpeech();
    await production;

    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')),
    );
    expect(manifest.segments.map((entry) => entry.segmentId)).toContain('seg_external_recovery');
    expect(manifest.segments).toHaveLength(2);
  });

  it('prepares safe scripts separately and packages them from the FIFO queue', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-script-queue-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');

    const prepared = await produceBatch({
      count: 2,
      concurrency: 2,
      outputRoot,
      demo: true,
      llm: null,
      tts: null,
      embeddingProvider: null,
      scriptQueueRoot,
      prepareScriptsOnly: true,
    });
    expect(prepared.mode).toBe('prepare-scripts');
    expect(prepared.preparedScriptCount).toBe(2);
    expect(
      (await readdir(path.join(scriptQueueRoot, 'pending'))).filter((file) =>
        file.endsWith('.json'),
      ),
    ).toHaveLength(2);

    const tts: TtsProvider = {
      id: 'queued-test-tts',
      parallelism: 2,
      synthesize(request: SpeechRequest): Promise<SpeechResult> {
        return Promise.resolve({
          audioFile: `audio/${request.speechId}.m4a`,
          durationMs: 1_000,
          provider: 'queued-test-tts',
        });
      },
    };
    const packaged = await produceBatch({
      count: 2,
      concurrency: 2,
      outputRoot,
      demo: false,
      llm: null,
      tts,
      embeddingProvider: null,
      scriptQueueRoot,
      packagePreparedScripts: true,
    });
    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')),
    );

    expect(packaged.mode).toBe('package-scripts');
    expect(packaged.segmentCount).toBe(2);
    expect(manifest.segments).toHaveLength(2);
    expect(await readdir(path.join(scriptQueueRoot, 'pending'))).toHaveLength(0);
    expect(await readdir(path.join(scriptQueueRoot, 'completed'))).toHaveLength(2);
  });

  it('keeps safe prepared scripts when another draft fails the final safety gate', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-safe-partial-queue-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');
    let proposalIndex = 0;
    let scriptIndex = 0;
    const llm: LlmProvider = {
      id: 'mixed-safety-test-llm',
      model: 'test-model',
      generateProposal() {
        const draft = demoDraft(proposalIndex);
        proposalIndex += 1;
        return Promise.resolve(universallyAlignedProposal(draft));
      },
      generateStructured(request) {
        const draft = demoDraft(scriptIndex);
        const proposalJson = request.userPrompt.match(
          /Turn this already approved proposal into a complete comedy segment:\n(\{.*\})\n\nPreserve/u,
        )?.[1];
        const proposal = generatedSegmentProposalSchema.parse(JSON.parse(proposalJson ?? '{}'));
        const dialogueCount = {
          frantic: 10,
          staccato: 8,
          conversational: 6,
          slow_burn: 6,
          interrupted: 4,
          near_silent: 4,
        }[proposal.pacing ?? 'conversational'];
        draft.dialogue = Array.from({ length: dialogueCount }, (_, index) => ({
          ...draft.dialogue[index % draft.dialogue.length]!,
          text: `${draft.dialogue[index % draft.dialogue.length]!.text} Beat ${index + 1}.`,
        }));
        if (scriptIndex === 0) {
          draft.dialogue[0]!.text = 'The red label bleeds through the paperwork overnight.';
        }
        scriptIndex += 1;
        return Promise.resolve(draft);
      },
    };

    const result = await produceBatch({
      count: 2,
      concurrency: 2,
      outputRoot,
      demo: false,
      llm,
      tts: null,
      embeddingProvider: null,
      scriptQueueRoot,
      prepareScriptsOnly: true,
    });

    expect(result.preparedScriptCount).toBe(1);
    expect(result.rejectedSegmentCount).toBe(1);
    expect(result.rejectionReasons).toEqual([
      expect.stringContaining('safety check rejected content'),
    ]);
    expect(
      (await readdir(path.join(scriptQueueRoot, 'pending'))).filter((file) =>
        file.endsWith('.json'),
      ),
    ).toHaveLength(1);
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
        if (requestCount <= 10) {
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

  it('removes incomplete package directories after speech preparation fails', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-failed-speech-'));
    temporaryDirectories.push(outputRoot);
    const tts: TtsProvider = {
      id: 'failed-test-tts',
      parallelism: 2,
      synthesize() {
        return Promise.reject(new Error('synthetic speech failure'));
      },
    };

    await expect(
      produceBatch({
        count: 1,
        concurrency: 1,
        outputRoot,
        demo: true,
        llm: null,
        tts,
        embeddingProvider: null,
      }),
    ).rejects.toThrow('Batch produced no approved segment packages');

    expect(
      (await readdir(outputRoot, { withFileTypes: true })).filter(
        (entry) => entry.isDirectory() && entry.name.startsWith('seg_'),
      ),
    ).toHaveLength(0);
  });

  it('screens a premise before requesting its full script', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-two-stage-'));
    temporaryDirectories.push(outputRoot);
    const draft = demoDraft(0);
    let proposalCalls = 0;
    let scriptCalls = 0;
    const llm: LlmProvider = {
      id: 'two-stage-test-llm',
      model: 'test-model',
      generateProposal() {
        proposalCalls += 1;
        return Promise.resolve(universallyAlignedProposal(draft));
      },
      generateStructured(request) {
        scriptCalls += 1;
        const proposalJson = request.userPrompt.match(
          /Turn this already approved proposal into a complete comedy segment:\n(\{.*\})\n\nPreserve/u,
        )?.[1];
        const proposal = generatedSegmentProposalSchema.parse(JSON.parse(proposalJson ?? '{}'));
        const dialogueCount = {
          frantic: 10,
          staccato: 8,
          conversational: 6,
          slow_burn: 6,
          interrupted: 4,
          near_silent: 4,
        }[proposal.pacing ?? 'conversational'];
        return Promise.resolve({
          ...draft,
          dialogue: Array.from({ length: dialogueCount }, (_, index) => ({
            ...draft.dialogue[index % draft.dialogue.length]!,
            text: `${draft.dialogue[index % draft.dialogue.length]!.text} Beat ${index + 1}.`,
          })),
        });
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

  it('allows thematic overlap when the comic mechanism is not a close paraphrase', () => {
    const issue = semanticNoveltyIssue(
      'A boxing coach loses access to the ring whenever the audience applauds.',
      [0.8, 0.6, 0],
      [
        {
          title: 'Tiny Exit',
          premise:
            'In a boxing gym, anyone who exits must re-enter through an impossibly small door.',
          dialogue: [],
        },
      ],
      [[1, 0, 0]],
    );

    expect(issue).toBeNull();
  });
});
