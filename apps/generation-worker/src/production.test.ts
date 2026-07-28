import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { playoutManifestSchema, segmentPackageSchema } from '@elsewhere-cable/schemas';
import { demoDraft } from './creative.js';
import { produceBatch } from './production.js';
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
  it('runs bounded generation concurrently and commits one valid manifest', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-batch-'));
    temporaryDirectories.push(outputRoot);
    let active = 0;
    let peakActive = 0;
    let draftIndex = 0;

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
        return demoDraft(index);
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
      count: 4,
      concurrency: 2,
      outputRoot,
      demo: false,
      llm,
      tts,
    });
    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')),
    );

    expect(peakActive).toBe(2);
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
});
