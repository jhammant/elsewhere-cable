import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  optimisationBriefSchema,
  playoutManifestSchema,
  type OptimisationBrief,
} from '@elsewhere-cable/schemas';
import { produceBatch } from './production.js';
import {
  LocalCommandTtsProvider,
  OllamaEmbeddingProvider,
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

function proposalAttemptsArgument(): number {
  const attempts = Number(
    argument('proposal-attempts') ?? process.env.ELSEWHERE_PROPOSAL_ATTEMPTS ?? 16,
  );
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 64) {
    throw new Error('--proposal-attempts must be an integer from 1 to 64');
  }
  return attempts;
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

async function readOptimisationBrief(
  filePath: string | undefined,
): Promise<OptimisationBrief | null> {
  if (filePath === undefined) {
    return null;
  }
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
  return optimisationBriefSchema.parse(JSON.parse(await readFile(resolvedPath, 'utf8')));
}

async function main(): Promise<void> {
  const demo = process.argv.includes('--demo');
  const prepareScriptsOnly = process.argv.includes('--prepare-scripts');
  const packagePreparedScripts = process.argv.includes('--package-scripts');
  if (prepareScriptsOnly && packagePreparedScripts) {
    throw new Error('--prepare-scripts and --package-scripts are mutually exclusive');
  }
  const ifEmpty = process.argv.includes('--if-empty');
  const model = argument('model') ?? process.env.ELSEWHERE_LLM_MODEL ?? 'llama3.2:3b';
  const baseUrl =
    argument('base-url') ?? process.env.ELSEWHERE_LLM_BASE_URL ?? 'http://127.0.0.1:11434/v1';
  const apiKey = process.env.ELSEWHERE_LLM_API_KEY ?? 'ollama-local';
  const criticModel = argument('critic-model') ?? process.env.ELSEWHERE_CRITIC_MODEL;
  const criticBaseUrl =
    argument('critic-base-url') ?? process.env.ELSEWHERE_CRITIC_BASE_URL ?? baseUrl;
  const criticApiKey =
    process.env.ELSEWHERE_CRITIC_API_KEY ?? process.env.ELSEWHERE_LLM_API_KEY ?? 'ollama-local';
  const proposalModel = argument('proposal-model') ?? process.env.ELSEWHERE_PROPOSAL_MODEL;
  const proposalBaseUrl =
    argument('proposal-base-url') ?? process.env.ELSEWHERE_PROPOSAL_BASE_URL ?? baseUrl;
  const proposalApiKey =
    process.env.ELSEWHERE_PROPOSAL_API_KEY ?? process.env.ELSEWHERE_LLM_API_KEY ?? 'ollama-local';
  const outputRoot = path.resolve(
    workspaceRoot,
    argument('output') ?? process.env.ELSEWHERE_SEGMENTS_DIR ?? 'data/segments',
  );
  const historyRoot = argument('history');
  const scriptQueueRoot = path.resolve(
    workspaceRoot,
    argument('script-queue') ?? process.env.ELSEWHERE_SCRIPT_QUEUE_DIR ?? 'data/script-reservoir',
  );
  const optimisationBrief = await readOptimisationBrief(
    argument('optimisation-brief') ?? process.env.ELSEWHERE_OPTIMISATION_BRIEF,
  );

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
  const tts = prepareScriptsOnly
    ? null
    : ttsBaseUrl === undefined
      ? await LocalCommandTtsProvider.create()
      : new OpenAiCompatibleTtsProvider(
          argument('tts-model') ?? process.env.ELSEWHERE_TTS_MODEL ?? 'kokoro',
          ttsBaseUrl,
          process.env.ELSEWHERE_TTS_API_KEY,
        );
  const llm =
    demo || packagePreparedScripts
      ? null
      : new OpenAiCompatibleProvider(
          model,
          baseUrl,
          apiKey,
          criticModel === undefined
            ? null
            : {
                model: criticModel,
                baseUrl: criticBaseUrl,
                apiKey: criticApiKey,
              },
          proposalModel === undefined
            ? null
            : {
                model: proposalModel,
                baseUrl: proposalBaseUrl,
                apiKey: proposalApiKey,
              },
        );
  const embeddingProvider =
    demo || packagePreparedScripts
      ? null
      : new OllamaEmbeddingProvider(
          argument('embedding-model') ??
            process.env.ELSEWHERE_EMBEDDING_MODEL ??
            'nomic-embed-text:latest',
          argument('embedding-base-url') ??
            process.env.ELSEWHERE_EMBEDDING_BASE_URL ??
            'http://127.0.0.1:11434',
        );
  const result = await produceBatch({
    count: countArgument(),
    concurrency: concurrencyArgument(),
    outputRoot,
    demo,
    llm,
    tts,
    embeddingProvider,
    optimisationBrief,
    scriptQueueRoot,
    prepareScriptsOnly,
    packagePreparedScripts,
    proposalAttempts: proposalAttemptsArgument(),
    fresh: process.argv.includes('--fresh'),
    ...(historyRoot === undefined
      ? {}
      : { historyRoots: [path.resolve(workspaceRoot, historyRoot)] }),
  });

  const serialisedResult = `${JSON.stringify(result, null, 2)}\n`;
  const resultFile = argument('result-file');
  if (resultFile !== undefined) {
    await writeFile(
      path.isAbsolute(resultFile) ? resultFile : path.resolve(workspaceRoot, resultFile),
      serialisedResult,
      'utf8',
    );
  }
  process.stdout.write(serialisedResult);
}

await main();
