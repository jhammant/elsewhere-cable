import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { playoutManifestSchema } from '@elsewhere-cable/schemas';
import { produceBatch } from './production.js';
import {
  LocalCommandTtsProvider,
  OpenAiCompatibleProvider,
  OpenAiCompatibleTtsProvider,
} from './providers.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function countArgument(): number {
  const count = Number(argument('count') ?? 4);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('--count must be an integer from 1 to 100');
  }
  return count;
}

function concurrencyArgument(): number {
  const concurrency = Number(argument('concurrency') ?? 1);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error('--concurrency must be an integer from 1 to 4');
  }
  return concurrency;
}

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(sourceDirectory, '../../..');

async function queueHasSegments(outputRoot: string): Promise<boolean> {
  try {
    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')),
    );
    return manifest.segments.length > 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const demo = process.argv.includes('--demo');
  const ifEmpty = process.argv.includes('--if-empty');
  const model = argument('model') ?? process.env.ELSEWHERE_LLM_MODEL ?? 'llama3.2:3b';
  const baseUrl =
    argument('base-url') ?? process.env.ELSEWHERE_LLM_BASE_URL ?? 'http://127.0.0.1:11434/v1';
  const apiKey = process.env.ELSEWHERE_LLM_API_KEY ?? 'ollama-local';
  const outputRoot = path.resolve(
    workspaceRoot,
    argument('output') ?? process.env.ELSEWHERE_SEGMENTS_DIR ?? 'data/segments',
  );
  const historyRoot = argument('history');

  if (ifEmpty && (await queueHasSegments(outputRoot))) {
    process.stdout.write(
      `${JSON.stringify(
        {
          skipped: true,
          reason: 'prepared queue already contains segments',
          outputRoot,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const ttsBaseUrl = argument('tts-base-url') ?? process.env.ELSEWHERE_TTS_BASE_URL;
  const tts =
    ttsBaseUrl === undefined
      ? await LocalCommandTtsProvider.create()
      : new OpenAiCompatibleTtsProvider(
          argument('tts-model') ?? process.env.ELSEWHERE_TTS_MODEL ?? 'kokoro',
          ttsBaseUrl,
          process.env.ELSEWHERE_TTS_API_KEY,
        );
  const llm = demo ? null : new OpenAiCompatibleProvider(model, baseUrl, apiKey);
  const result = await produceBatch({
    count: countArgument(),
    concurrency: concurrencyArgument(),
    outputRoot,
    demo,
    llm,
    tts,
    fresh: process.argv.includes('--fresh'),
    ...(historyRoot === undefined
      ? {}
      : { historyRoots: [path.resolve(workspaceRoot, historyRoot)] }),
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
