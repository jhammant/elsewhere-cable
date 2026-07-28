import { execFile } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GeneratedSegmentDraft } from '@elsewhere-cable/schemas';
import { generatedSegmentDraftSchema } from '@elsewhere-cable/schemas';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

export interface StructuredGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  generateStructured(request: StructuredGenerationRequest): Promise<GeneratedSegmentDraft>;
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

  async generateStructured(request: StructuredGenerationRequest): Promise<GeneratedSegmentDraft> {
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
{"channelNumber":42,"channelName":"Example Channel","programmeTitle":"Example Programme","format":"public_access","realityId":"REALITY-42","visualStyle":"public_access_1991","premise":"One clear sentence.","tone":["dry","surreal"],"dialogue":[{"speaker":"Host Name","text":"A short opening line.","action":"IDLE"},{"speaker":"Guest Name","text":"A short response.","action":"REACTION_CONFUSED"},{"speaker":"Host Name","text":"The rule becomes clear.","action":"POINT_AT"},{"speaker":"Guest Name","text":"The rule escalates.","action":"REACTION_SHOCKED"},{"speaker":"Host Name","text":"The ending line.","action":"FREEZE"}],"continuityFact":"One proposed fictional fact.","endingBeat":"One visual ending."}
${repairInstruction}`,
            },
          ],
          temperature: attempt === 0 ? 0.85 : 0.45,
          max_tokens: 4_096,
          reasoning_effort: 'none',
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'elsewhere_segment',
              strict: true,
              schema: z.toJSONSchema(generatedSegmentDraftSchema),
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
        return generatedSegmentDraftSchema.parse(JSON.parse(cleaned));
      } catch (error) {
        lastError = error;
        repairInstruction =
          '\nYour previous shape was invalid. realityId must be a quoted string. Every dialogue entry must be an object with the keys speaker, text, and action. Return the complete corrected object only.';
      }
    }

    throw new Error(
      `LLM failed the structured-output contract after one repair: ${lastError instanceof Error ? lastError.message : 'unknown validation error'}`,
    );
  }
}

export interface SpeechRequest {
  speechId: string;
  text: string;
  voiceId: string;
  outputDirectory: string;
}

export interface SpeechResult {
  audioFile: string;
  durationMs: number;
  provider: string;
}

export interface TtsProvider {
  readonly id: string;
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

export class LocalCommandTtsProvider implements TtsProvider {
  readonly id: string;

  private constructor(private readonly backend: 'say' | 'espeak-ng' | 'silence') {
    this.id = `local-${backend}`;
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
      await execFileAsync('say', [
        '-v',
        request.voiceId,
        '-r',
        '172',
        '-o',
        sourceFile,
        request.text,
      ]);
    } else if (this.backend === 'espeak-ng') {
      await execFileAsync('espeak-ng', ['-s', '165', '-w', sourceFile, request.text]);
    } else {
      const estimatedSeconds = Math.max(1, request.text.split(/\s+/u).length / 2.7);
      await execFileAsync('ffmpeg', [
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
      ]);
    }

    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      sourceFile,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ar',
      '48000',
      '-y',
      outputFile,
    ]);
    await unlink(sourceFile);

    return {
      audioFile: path.posix.join('audio', path.basename(outputFile)),
      durationMs: await probeDurationMs(outputFile),
      provider: this.id,
    };
  }
}
