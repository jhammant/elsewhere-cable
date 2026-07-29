import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  draftStructuralExample,
  maximumPlausibleSpeechDurationMs,
  OpenAiCompatibleProvider,
  OpenAiCompatibleTtsProvider,
  proposalStructuralExample,
  speechAudioQualityIssue,
  speechTempoCorrection,
} from './providers.js';
import { demoDraft } from './creative.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('OpenAiCompatibleTtsProvider', () => {
  it('builds neutral structural examples from the assigned creative coordinates', () => {
    const request = {
      systemPrompt: 'Return JSON.',
      userPrompt: `Create batch segment 71 using the news format.
- Visual medium: pixel_broadcast.
- Pacing: frantic.
- Story mode: object_agency.`,
    };
    const proposal = JSON.parse(proposalStructuralExample(request)) as {
      format: string;
      visualMedium: string;
      pacing: string;
      storyMode: string;
    };
    const draft = JSON.parse(draftStructuralExample(request)) as {
      dialogue: unknown[];
    };

    expect(proposal).toMatchObject({
      format: 'news',
      visualMedium: 'pixel_broadcast',
      pacing: 'frantic',
      storyMode: 'object_agency',
    });
    expect(draft.dialogue).toHaveLength(10);
  });

  it('can route editorial criticism to a smaller independent model', async () => {
    const requests: Array<{ url: string; model: string; systemPrompt: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (typeof init?.body !== 'string') {
          throw new Error('Expected a JSON request body');
        }
        const body = JSON.parse(init.body) as {
          model: string;
          messages?: Array<{ role?: string; content?: string }>;
        };
        requests.push({
          url,
          model: body.model,
          systemPrompt: body.messages?.find(({ role }) => role === 'system')?.content ?? '',
        });
        return Promise.resolve(
          Response.json({
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: JSON.stringify({
                    accepted: true,
                    coherence: 8,
                    comedyEscalation: 7,
                    dialogueNaturalness: 8,
                    endingEarned: 8,
                    issues: [],
                  }),
                },
              },
            ],
          }),
        );
      }),
    );
    const provider = new OpenAiCompatibleProvider(
      'writer-model',
      'http://writer.test/v1',
      'writer',
      {
        model: 'critic-model',
        baseUrl: 'http://critic.test/v1',
        apiKey: 'critic',
      },
    );

    await expect(provider.critiqueDraft(demoDraft(0))).resolves.toMatchObject({
      accepted: true,
      coherence: 8,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: 'http://critic.test/v1/chat/completions',
      model: 'critic-model',
    });
    expect(requests[0]?.systemPrompt).toContain(
      'A character may naturally state a first-person intention',
    );
  });

  it('rejects rambling audio while allowing deliberate broadcast pacing', () => {
    expect(maximumPlausibleSpeechDurationMs('A short line.')).toBe(7_000);
    expect(
      maximumPlausibleSpeechDurationMs(
        'The municipal staircase has requested a private meeting after lunch.',
      ),
    ).toBe(10_500);
    expect(
      maximumPlausibleSpeechDurationMs(
        'This intentionally long continuity announcement contains enough words to reach the hard broadcast ceiling without ever allowing an unbounded speech file onto the channel.',
      ),
    ).toBe(18_000);
  });

  it('tempo-corrects a near miss but rejects severely rambling speech', () => {
    const text = 'One two three four five six seven eight';
    expect(maximumPlausibleSpeechDurationMs(text)).toBe(8_900);
    expect(speechTempoCorrection(text, 9_280)).toBeCloseTo(1.092, 3);
    expect(speechTempoCorrection(text, 20_000)).toBeNull();
  });

  it('rejects long internal dead air while allowing a short natural pause', () => {
    expect(
      speechAudioQualityIssue({
        durationMs: 9_400,
        meanVolumeDb: -20.6,
        maxVolumeDb: -6.2,
        silenceDurationMs: 7_760,
        silenceRatio: 0.826,
      }),
    ).toContain('silence');
    expect(
      speechAudioQualityIssue({
        durationMs: 3_700,
        meanVolumeDb: -15.7,
        maxVolumeDb: -1.9,
        silenceDurationMs: 380,
        silenceRatio: 0.103,
      }),
    ).toBeNull();
  });

  it('uses stable named speakers for Qwen CustomVoice models', () => {
    const provider = new OpenAiCompatibleTtsProvider(
      'mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-6bit',
      'http://127.0.0.1:8880/v1',
    );

    expect(provider.voiceIds).toContain('Ryan');
    expect(provider.voiceIds).toContain('Serena');
  });

  it('rotates across a pool and fails over before rejecting a speech request', async () => {
    const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-tts-pool-'));
    temporaryDirectories.push(outputDirectory);
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        requestedUrls.push(
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        );
        return Promise.resolve(new Response('', { status: 503 }));
      }),
    );
    const provider = new OpenAiCompatibleTtsProvider(
      'test-model',
      'http://127.0.0.1:8878/v1, http://127.0.0.1:8879/v1',
    );
    const request = {
      speechId: 'speech_00',
      text: 'The test voice is unavailable today.',
      voiceId: 'test voice',
      outputDirectory,
    };

    expect(provider.parallelism).toBe(2);
    await expect(provider.synthesize(request)).rejects.toThrow('All TTS endpoints failed');
    await expect(provider.synthesize(request)).rejects.toThrow('All TTS endpoints failed');

    expect(requestedUrls).toEqual([
      'http://127.0.0.1:8878/v1/audio/speech',
      'http://127.0.0.1:8879/v1/audio/speech',
      'http://127.0.0.1:8879/v1/audio/speech',
      'http://127.0.0.1:8878/v1/audio/speech',
    ]);
  });
});
