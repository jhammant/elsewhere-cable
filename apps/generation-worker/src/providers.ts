import { execFile } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GeneratedSegmentDraft, GeneratedSegmentProposal } from '@elsewhere-cable/schemas';
import {
  generatedSegmentDraftSchema,
  generatedSegmentProposalSchema,
} from '@elsewhere-cable/schemas';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const localSpeechProcessOptions = {
  timeout: 60_000,
  killSignal: 'SIGKILL' as const,
};

export interface StructuredGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  generateProposal?(request: StructuredGenerationRequest): Promise<GeneratedSegmentProposal>;
  generateStructured(request: StructuredGenerationRequest): Promise<GeneratedSegmentDraft>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  embed(texts: readonly string[]): Promise<number[][]>;
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'ollama-embedding';

  constructor(
    readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const embeddings: number[][] = [];
    for (let index = 0; index < texts.length; index += 64) {
      const batch = texts.slice(index, index + 64);
      const response = await fetch(`${this.baseUrl.replace(/\/$/u, '')}/api/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: batch.map((text) => `clustering: ${text}`),
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`Semantic novelty request failed with HTTP ${response.status}`);
      }
      const result = (await response.json()) as OllamaEmbedResponse;
      if (
        result.embeddings === undefined ||
        result.embeddings.length !== batch.length ||
        result.embeddings.some(
          (embedding) =>
            embedding.length === 0 || embedding.some((value) => !Number.isFinite(value)),
        )
      ) {
        throw new Error('Semantic novelty provider returned malformed embeddings');
      }
      embeddings.push(...result.embeddings);
    }
    return embeddings;
  }
}

interface ChatCompletion {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id = 'openai-compatible';

  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private async generateWithSchema<T>(
    request: StructuredGenerationRequest,
    schema: z.ZodType<T>,
    schemaName: string,
    structuralExample: string,
    maxTokens: number,
  ): Promise<T> {
    let repairInstruction = '';
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${this.baseUrl.replace(/\/$/u, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            {
              role: 'user',
              content: `${request.userPrompt}

Use this structural example exactly:
${structuralExample}
${repairInstruction}`,
            },
          ],
          temperature: attempt === 0 ? 1.05 : 0.6,
          top_p: 0.95,
          presence_penalty: 0.45,
          frequency_penalty: 0.25,
          max_tokens: maxTokens,
          reasoning_effort: 'none',
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: schemaName,
              strict: true,
              schema: z.toJSONSchema(schema),
            },
          },
        }),
        signal: AbortSignal.timeout(180_000),
      });

      if (!response.ok) {
        throw new Error(`LLM request failed with HTTP ${response.status}`);
      }
      const completion = (await response.json()) as ChatCompletion;
      const message = completion.choices?.[0]?.message;
      const content =
        message?.content?.trim() === '' ? message.reasoning_content : message?.content;
      if (content === undefined) {
        throw new Error(
          `LLM response did not contain message content (finish reason: ${completion.choices?.[0]?.finish_reason ?? 'unknown'})`,
        );
      }

      const cleaned = content
        .replace(/^```(?:json)?\s*/iu, '')
        .replace(/\s*```$/u, '')
        .trim();
      try {
        return schema.parse(JSON.parse(cleaned));
      } catch (error) {
        lastError = error;
        repairInstruction =
          '\nYour previous shape was invalid. Preserve every required key and enum value from the structural example. Return the complete corrected object only.';
      }
    }

    throw new Error(
      `LLM failed the structured-output contract after one repair: ${lastError instanceof Error ? lastError.message : 'unknown validation error'}`,
    );
  }

  generateProposal(request: StructuredGenerationRequest): Promise<GeneratedSegmentProposal> {
    return this.generateWithSchema(
      request,
      generatedSegmentProposalSchema,
      'elsewhere_proposal',
      '{"channelNumber":4700219,"channelName":"Example Channel","programmeTitle":"Example Programme","format":"public_access","realityId":"REALITY-42","visualStyle":"public_access_1991","visualMedium":"public_access_vhs","castArchetype":"mixed","pacing":"interrupted","premise":"One clear comic rule in a physical setting.","tone":["dry","surreal"],"continuityFact":"One proposed fictional fact.","endingBeat":"One visual ending."}',
      1_024,
    );
  }

  generateStructured(request: StructuredGenerationRequest): Promise<GeneratedSegmentDraft> {
    return this.generateWithSchema(
      request,
      generatedSegmentDraftSchema,
      'elsewhere_segment',
      '{"channelNumber":4700219,"channelName":"Example Channel","programmeTitle":"Example Programme","format":"public_access","realityId":"REALITY-42","visualStyle":"public_access_1991","visualMedium":"public_access_vhs","castArchetype":"mixed","pacing":"interrupted","premise":"One clear sentence.","tone":["dry","surreal"],"dialogue":[{"speaker":"Host Name","text":"A short opening line.","action":"POINT_AT"},{"speaker":"Guest Name","text":"A short response.","action":"REACTION_CONFUSED"},{"speaker":"Third Presence","text":"The rule becomes clear.","action":"POINT_AT"},{"speaker":"Object Witness","text":"The rule escalates.","action":"REACTION_SHOCKED"},{"speaker":"Host Name","text":"The ending line.","action":"FREEZE"}],"continuityFact":"One proposed fictional fact.","endingBeat":"One visual ending."}',
      2_048,
    );
  }
}

export interface SpeechRequest {
  speechId: string;
  text: string;
  voiceId: string;
  speakingRate?: number;
  outputDirectory: string;
}

export interface SpeechResult {
  audioFile: string;
  durationMs: number;
  provider: string;
}

export interface TtsProvider {
  readonly id: string;
  readonly voiceIds?: readonly string[];
  readonly parallelism?: number;
  synthesize(request: SpeechRequest): Promise<SpeechResult>;
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(process.platform === 'win32' ? 'where' : 'which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function probeDurationMs(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ]);
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not determine speech duration for ${path.basename(audioPath)}`);
  }
  return Math.ceil(seconds * 1_000);
}

export function maximumPlausibleSpeechDurationMs(text: string): number {
  const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.min(18_000, Math.max(7_000, wordCount * 800 + 2_500));
}

export function speechTempoCorrection(text: string, durationMs: number): number | null {
  const maximumDurationMs = maximumPlausibleSpeechDurationMs(text);
  if (durationMs > maximumDurationMs * 1.6) {
    return null;
  }
  if (durationMs <= maximumDurationMs) {
    return 1;
  }
  // Leave room for AAC encoder padding and ffprobe rounding so the independently audited
  // package remains below the same hard ceiling.
  return durationMs / (maximumDurationMs - 400);
}

export class LocalCommandTtsProvider implements TtsProvider {
  readonly id: string;
  readonly voiceIds: readonly string[];

  private constructor(private readonly backend: 'say' | 'espeak-ng' | 'silence') {
    this.id = `local-${backend}`;
    this.voiceIds =
      backend === 'say'
        ? ['Samantha', 'Daniel', 'Moira', 'Karen', 'Rishi', 'Tessa', 'Eddy', 'Flo']
        : ['default'];
  }

  static async create(): Promise<LocalCommandTtsProvider> {
    if (process.platform === 'darwin' && (await commandAvailable('say'))) {
      return new LocalCommandTtsProvider('say');
    }
    if (await commandAvailable('espeak-ng')) {
      return new LocalCommandTtsProvider('espeak-ng');
    }
    if (await commandAvailable('ffmpeg')) {
      return new LocalCommandTtsProvider('silence');
    }
    throw new Error('No supported local TTS or FFmpeg fallback is available');
  }

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const audioDirectory = path.join(request.outputDirectory, 'audio');
    await mkdir(audioDirectory, { recursive: true });
    const sourceFile = path.join(
      audioDirectory,
      `${request.speechId}.${this.backend === 'espeak-ng' ? 'wav' : 'aiff'}`,
    );
    const outputFile = path.join(audioDirectory, `${request.speechId}.m4a`);

    if (this.backend === 'say') {
      const wordsPerMinute = Math.round(172 * (request.speakingRate ?? 1));
      await execFileAsync(
        'say',
        ['-v', request.voiceId, '-r', String(wordsPerMinute), '-o', sourceFile, request.text],
        localSpeechProcessOptions,
      );
    } else if (this.backend === 'espeak-ng') {
      const wordsPerMinute = Math.round(165 * (request.speakingRate ?? 1));
      await execFileAsync(
        'espeak-ng',
        ['-s', String(wordsPerMinute), '-w', sourceFile, request.text],
        localSpeechProcessOptions,
      );
    } else {
      const estimatedSeconds = Math.max(1, request.text.split(/\s+/u).length / 2.7);
      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'anullsrc=r=48000:cl=mono',
          '-t',
          estimatedSeconds.toFixed(2),
          '-y',
          sourceFile,
        ],
        localSpeechProcessOptions,
      );
    }

    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        sourceFile,
        '-af',
        'loudnorm=I=-16:LRA=7:TP=-1.5',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-ar',
        '48000',
        '-y',
        outputFile,
      ],
      localSpeechProcessOptions,
    );
    await unlink(sourceFile);

    return {
      audioFile: path.posix.join('audio', path.basename(outputFile)),
      durationMs: await probeDurationMs(outputFile),
      provider: this.id,
    };
  }
}

export class OpenAiCompatibleTtsProvider implements TtsProvider {
  readonly id = 'openai-compatible-tts';
  readonly voiceIds: readonly string[];
  readonly parallelism: number;
  private readonly baseUrls: readonly string[];
  private nextBaseUrl = 0;

  constructor(
    readonly model: string,
    baseUrl: string,
    private readonly apiKey = '',
  ) {
    this.baseUrls = baseUrl
      .split(',')
      .map((value) => value.trim().replace(/\/$/u, ''))
      .filter(Boolean);
    if (this.baseUrls.length === 0) {
      throw new Error('TTS base URL must contain at least one endpoint');
    }
    this.parallelism = this.baseUrls.length;
    this.voiceIds = model.toLowerCase().includes('customvoice')
      ? ['Ryan', 'Aiden', 'Serena', 'Vivian', 'Uncle_Fu', 'Dylan', 'Eric', 'Ono_Anna', 'Sohee']
      : model.toLowerCase().includes('qwen')
        ? [
            'Dry British woman, low calm register, precise diction, restrained irritation',
            'Weary British man, gentle baritone, hesitant warmth, excellent deadpan timing',
            'Bright northern English woman, brisk delivery, practical and quietly alarmed',
            'Older Welsh man, textured voice, patient authority, faintly disappointed',
            'Young London man, clipped confidence, fragile enthusiasm, conversational',
            'Scottish woman, measured alto, civic authority, understated disbelief',
            'Soft-spoken Irish man, warm tenor, careful pauses, private amusement',
            'Midlands woman, clear contralto, officious composure, sudden vulnerability',
          ]
        : [
            'bf_emma',
            'bm_george',
            'af_nova',
            'am_echo',
            'bf_isabella',
            'bm_lewis',
            'af_sky',
            'am_adam',
          ];
  }

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const audioDirectory = path.join(request.outputDirectory, 'audio');
    await mkdir(audioDirectory, { recursive: true });
    const sourceFile = path.join(audioDirectory, `${request.speechId}.wav`);
    const outputFile = path.join(audioDirectory, `${request.speechId}.m4a`);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey !== '') {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const firstBaseUrl = this.nextBaseUrl;
    this.nextBaseUrl = (this.nextBaseUrl + 1) % this.baseUrls.length;
    let sourceDurationMs: number | undefined;
    let tempoCorrection = 1;
    const failures: string[] = [];
    for (let offset = 0; offset < this.baseUrls.length; offset += 1) {
      const baseUrl = this.baseUrls[(firstBaseUrl + offset) % this.baseUrls.length]!;
      try {
        const candidate = await fetch(`${baseUrl}/audio/speech`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: this.model,
            input: request.text,
            voice: request.voiceId,
            speed: request.speakingRate ?? 1,
            response_format: 'wav',
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!candidate.ok) {
          failures.push(`${baseUrl}: HTTP ${candidate.status}`);
          continue;
        }
        await writeFile(sourceFile, Buffer.from(await candidate.arrayBuffer()));
        const durationMs = await probeDurationMs(sourceFile);
        const maximumPlausibleDurationMs = maximumPlausibleSpeechDurationMs(request.text);
        const candidateTempoCorrection = speechTempoCorrection(request.text, durationMs);
        if (candidateTempoCorrection === null) {
          failures.push(
            `${baseUrl}: implausible ${durationMs}ms audio for ${request.text.trim().split(/\s+/u).length} words (maximum recoverable ${Math.round(maximumPlausibleDurationMs * 1.6)}ms)`,
          );
          await unlink(sourceFile);
          continue;
        }
        sourceDurationMs = durationMs;
        tempoCorrection = candidateTempoCorrection;
        break;
      } catch (error) {
        failures.push(`${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (sourceDurationMs === undefined) {
      throw new Error(`All TTS endpoints failed: ${failures.join('; ')}`);
    }
    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      sourceFile,
      '-af',
      `${tempoCorrection > 1 ? `atempo=${tempoCorrection.toFixed(4)},` : ''}loudnorm=I=-16:LRA=7:TP=-1.5`,
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-ar',
      '48000',
      '-y',
      outputFile,
    ]);
    await unlink(sourceFile);

    return {
      audioFile: path.posix.join('audio', path.basename(outputFile)),
      durationMs: await probeDurationMs(outputFile),
      provider: `${this.id}:${this.model}`,
    };
  }
}
