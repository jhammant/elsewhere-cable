import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generatedSegmentProposalSchema } from '@elsewhere-cable/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  draftStructuralExample,
  minimumPlausibleSpeechDurationMs,
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
- Physical setting: a miniature newsroom inside a closed florist.
- Visual medium: pixel_broadcast.
- Pacing: frantic.
- Story mode: object_agency.`,
    };
    const proposal = JSON.parse(proposalStructuralExample(request)) as {
      programmeTitle: string;
      format: string;
      visualMedium: string;
      pacing: string;
      storyMode: string;
      premise: string;
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
    expect(proposal.premise).toMatch(
      /^At a miniature newsroom inside a closed florist, a placeholder news anchor/u,
    );
    expect(proposal.premise).toContain('object explicitly demands');
    expect(proposal.programmeTitle).toContain('SUBJECT');
    expect(proposal.premise).toContain('original subject');
    expect(draft.dialogue).toHaveLength(10);
  });

  it('demonstrates the assigned dialogue cadence instead of teaching ABAB by default', () => {
    const unequal = JSON.parse(
      draftStructuralExample({
        systemPrompt: 'Return JSON.',
        userPrompt: `Create a shopping segment.
- Pacing: conversational.
- Dialogue architecture: Unequal exchange: one speaker takes consecutive turns.`,
      }),
    ) as {
      dialogue: Array<{ speaker: string; action: string }>;
    };
    const consecutiveTurns = unequal.dialogue
      .slice(1)
      .filter((line, index) => line.speaker === unequal.dialogue[index]?.speaker);
    expect(consecutiveTurns.length).toBeGreaterThanOrEqual(2);

    const sparse = JSON.parse(
      draftStructuralExample({
        systemPrompt: 'Return JSON.',
        userPrompt: `Create a public_access segment.
- Pacing: near_silent.
- Dialogue architecture: Sparse reaction scene: use held reactions.`,
      }),
    ) as {
      dialogue: Array<{ speaker: string; action: string }>;
    };
    expect(sparse.dialogue).toHaveLength(4);
    expect(
      sparse.dialogue.filter((line) => ['PAUSE', 'FREEZE'].includes(line.action)),
    ).toHaveLength(2);
  });

  it('models proactive social conflict instead of a refusal template', () => {
    const proposal = JSON.parse(
      proposalStructuralExample({
        systemPrompt: 'Return JSON.',
        userPrompt: `Create batch segment 72 using the sitcom format.
- Physical setting: a shared kitchen after lunch.
- Story mode: social_protocol.`,
      }),
    ) as { premise: string };

    expect(proposal.premise).toContain('both claims valid');
    expect(proposal.premise).not.toContain('refuses because');
  });

  it('carries the exact assigned mechanism into the proposal example', () => {
    const proposal = JSON.parse(
      proposalStructuralExample({
        systemPrompt: 'Return JSON.',
        userPrompt: `Create batch segment 72 using the sitcom format.
- Physical setting: a shared kitchen.
- Story mode: semantic_contract.
- Mechanism variant: saying fine assigns the speaker the last clean mug. Treat this as the exact subtype of the comedy mechanism.
- Visual medium: paper_cutout.
- Pacing: slow_burn.`,
      }),
    ) as { premise: string };

    expect(proposal.premise).toContain('saying fine assigns the speaker the last clean mug');
    expect(proposal.premise).not.toContain('exact comic rule');
    expect(proposal.premise).not.toContain('one harmless social consequence');
    expect(proposal.premise).not.toContain('one spoken phrase');
  });

  it('carries a generated comedy kernel into the proposal and ending examples', () => {
    const proposal = JSON.parse(
      proposalStructuralExample({
        systemPrompt: 'Return JSON.',
        userPrompt: `Create batch segment 73 using the shopping format.
- Physical setting: a breakfast counter inside a repair shop.
- Story mode: status_transfer.
- Mechanism variant: Rule: Control of the kettle passes to the person whose biscuit breaks most quietly. | Protagonist goal: One flatmate wants to make tea before leaving for work. | Opposing goal: The other flatmate wants the kettle for a longer breakfast. | Earned payoff: The quietest biscuit holder serves one cup and keeps the kettle. Treat this as the exact subtype of the comedy mechanism.
- Visual medium: stop_motion.
- Pacing: conversational.`,
      }),
    ) as { premise: string; endingBeat: string };

    expect(proposal.premise).toContain('One flatmate wants to make tea before leaving for work.');
    expect(proposal.premise).toContain(
      'The other flatmate wants the kettle for a longer breakfast.',
    );
    expect(proposal.premise).toContain(
      'Control of the kettle passes to the person whose biscuit breaks most quietly.',
    );
    expect(proposal.endingBeat).toContain(
      'The quietest biscuit holder serves one cup and keeps the kettle.',
    );
  });

  it('keeps a bounded local-server error detail when an LLM request is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: 'Context length exceeded by the structured request.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );
    const provider = new OpenAiCompatibleProvider('writer-model', 'http://writer.test/v1', 'local');

    await expect(
      provider.generateProposal({
        systemPrompt: 'Return JSON.',
        userPrompt: 'Create an original fictional segment.',
      }),
    ).rejects.toThrow(
      'LLM request failed with HTTP 400: {"error":"Context length exceeded by the structured request."}',
    );
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
    expect(requests[0]?.systemPrompt).toContain(
      "Trace the premise's single cause and effect through every dialogue line",
    );
    expect(requests[0]?.systemPrompt).toContain(
      'Audit every declarative dialogue line for a newly invented exemption',
    );
  });

  it('can route premise proposals to a smaller independent model', async () => {
    const requests: Array<{
      url: string;
      model: string | undefined;
      temperature: number | undefined;
      presencePenalty: number | undefined;
    }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (typeof init?.body !== 'string') {
          throw new Error('Expected a JSON request body');
        }
        const body = JSON.parse(init.body) as {
          model?: string;
          temperature?: number;
          presence_penalty?: number;
        };
        requests.push({
          url,
          model: body.model,
          temperature: body.temperature,
          presencePenalty: body.presence_penalty,
        });
        return Promise.resolve(
          Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    channelNumber: 7_000_000_001,
                    channelName: 'Proposal Channel',
                    programmeTitle: 'Proposal Programme',
                    format: 'public_access',
                    realityId: 'PROPOSAL-1',
                    visualStyle: 'proposal_style',
                    visualMedium: 'paper_cutout',
                    castArchetype: 'paper_puppets',
                    pacing: 'staccato',
                    storyMode: 'social_protocol',
                    premise:
                      'At a village hall, a clerk wants the final chair while a resident defends its speaking turn.',
                    tone: ['dry'],
                    continuityFact: 'Empty chairs receive one speaking turn.',
                    endingBeat: 'The clerk sits on the floor beside the chair.',
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
      null,
      {
        model: 'proposal-model',
        baseUrl: 'http://proposal.test/v1',
        apiKey: 'proposal',
      },
    );
    await provider.generateProposal({
      systemPrompt: 'system',
      userPrompt: 'Create a public_access segment.',
    });

    expect(requests).toEqual([
      {
        url: 'http://proposal.test/v1/chat/completions',
        model: 'proposal-model',
        temperature: 0.92,
        presencePenalty: 0.3,
      },
    ]);
  });

  it('generates a strict batch of bare comedy mechanisms on the proposal endpoint', async () => {
    const requests: Array<{
      url: string;
      model: string | undefined;
      schemaName: string | undefined;
      temperature: number | undefined;
      userPrompt: string;
    }> = [];
    const seeds = [
      {
        storyMode: 'social_protocol',
        mechanism: 'Touching the spare teaspoon requires its holder to introduce the next silence.',
        protagonistGoal: 'The host wants to serve tea before the guest leaves.',
        opposingGoal: 'The guest wants to leave before anyone begins another introduction.',
        earnedPayoff: 'The host gives the final introduction to the untouched teaspoon.',
      },
      {
        storyMode: 'service_mismatch',
        mechanism:
          'A professional queuing service arrives early and occupies the customer’s reunion.',
        protagonistGoal: 'The customer wants to greet a cousin privately at the doorway.',
        opposingGoal: 'The queue worker wants to hold that exact doorway until the booking ends.',
        earnedPayoff: 'The customer joins the queue and lets the cousin greet the worker first.',
      },
      {
        storyMode: 'status_transfer',
        mechanism: 'Control of the kettle passes to the person whose biscuit breaks most quietly.',
        protagonistGoal: 'One flatmate wants to make tea before leaving for work.',
        opposingGoal: 'The other flatmate wants the kettle for a longer breakfast.',
        earnedPayoff: 'The quietest biscuit holder serves one shared cup and keeps the kettle.',
      },
      {
        storyMode: 'format_literalism',
        mechanism: 'Every lower third becomes the only permitted answer to a mundane question.',
        protagonistGoal: 'The presenter wants to ask which sandwich belongs to the guest.',
        opposingGoal: 'The guest wants to claim the sandwich without changing their caption.',
        earnedPayoff: 'The presenter edits the caption to the sandwich and accepts that answer.',
      },
      {
        storyMode: 'object_agency',
        mechanism: 'The coat hook requests a window seat before it will hold anyone’s jacket.',
        protagonistGoal: 'The visitor wants to hang a wet jacket before sitting down.',
        opposingGoal: 'The coat hook wants the only window seat kept clear for itself.',
        earnedPayoff: 'The visitor wears the jacket and carries the hook to the window.',
      },
      {
        storyMode: 'product_consequence',
        mechanism:
          'A compliment-sorting device reveals that two flatmates praise the same lamp differently.',
        protagonistGoal: 'One flatmate wants the device to choose a truthful birthday compliment.',
        opposingGoal: 'The other flatmate wants their favourite lamp excluded from the test.',
        earnedPayoff: 'They give the lamp the birthday card and keep their own compliments.',
      },
      {
        storyMode: 'semantic_contract',
        mechanism:
          'Saying “nearly sorted” assigns the speaker responsibility for the smallest loose item.',
        protagonistGoal: 'The tenant wants to finish tidying before a visitor arrives.',
        opposingGoal: 'The flatmate wants the final loose button left for later.',
        earnedPayoff: 'The tenant pockets the button and declares the larger mess unfinished.',
      },
      {
        storyMode: 'visual_physics',
        mechanism:
          'Closing one drawer slides every table sideways until its owner admits choosing it.',
        protagonistGoal: 'The host wants one table centred for a formal interview.',
        opposingGoal: 'The guest wants the same table beside the studio exit.',
        earnedPayoff: 'The host admits choosing the table and lets it stop beside the guest.',
      },
    ] as const;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (typeof init?.body !== 'string') {
          throw new Error('Expected a JSON request body');
        }
        const body = JSON.parse(init.body) as {
          model?: string;
          temperature?: number;
          messages?: Array<{ role?: string; content?: string }>;
          response_format?: { json_schema?: { name?: string } };
        };
        requests.push({
          url,
          model: body.model,
          schemaName: body.response_format?.json_schema?.name,
          temperature: body.temperature,
          userPrompt: body.messages?.find(({ role }) => role === 'user')?.content ?? '',
        });
        return Promise.resolve(
          Response.json({
            choices: [{ message: { content: JSON.stringify({ seeds }) } }],
          }),
        );
      }),
    );
    const provider = new OpenAiCompatibleProvider(
      'writer-model',
      'http://writer.test/v1',
      'writer',
      null,
      {
        model: 'proposal-model',
        baseUrl: 'http://proposal.test/v1',
        apiKey: 'proposal',
      },
    );

    await expect(
      provider.generateMechanismSeeds({
        systemPrompt: 'Invent bare mechanisms.',
        userPrompt: 'Return two mechanisms for each story mode.',
      }),
    ).resolves.toEqual(seeds);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: 'http://proposal.test/v1/chat/completions',
      model: 'proposal-model',
      schemaName: 'elsewhere_mechanism_seeds',
      temperature: 1,
    });
    expect(requests[0]?.userPrompt).toContain('Return two mechanisms for each story mode.');
  });

  it('uses the critic endpoint to reject proposals with unearned endings', async () => {
    const requests: Array<{ url: string; schemaName: string | undefined }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (typeof init?.body !== 'string') {
          throw new Error('Expected a JSON request body');
        }
        const body = JSON.parse(init.body) as {
          response_format?: { json_schema?: { name?: string } };
        };
        requests.push({
          url,
          schemaName: body.response_format?.json_schema?.name,
        });
        return Promise.resolve(
          Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    accepted: false,
                    clarity: 8,
                    mechanismIntegrity: 7,
                    endingCausality: 3,
                    stageability: 7,
                    comedyPotential: 6,
                    issues: ['The ending introduces an unrelated kitchen certificate.'],
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

    await expect(
      provider.critiqueProposal(generatedSegmentProposalSchema.parse(demoDraft(0))),
    ).resolves.toMatchObject({
      accepted: false,
      endingCausality: 3,
    });
    expect(requests).toEqual([
      {
        url: 'http://critic.test/v1/chat/completions',
        schemaName: 'elsewhere_proposal_critique',
      },
    ]);
  });

  it('rejects rambling audio while allowing deliberate broadcast pacing', () => {
    expect(maximumPlausibleSpeechDurationMs('A short line.')).toBe(3_000);
    expect(
      maximumPlausibleSpeechDurationMs(
        'The municipal staircase has requested a private meeting after lunch.',
      ),
    ).toBe(6_500);
    expect(
      maximumPlausibleSpeechDurationMs(
        'This intentionally long continuity announcement contains enough words to reach the hard broadcast ceiling without ever allowing an unbounded speech file onto the channel.',
      ),
    ).toBe(14_200);
  });

  it('rejects clipped speech using word count and requested delivery speed', () => {
    const text = 'I need this box because my fridge is empty';
    expect(minimumPlausibleSpeechDurationMs(text)).toBe(1_500);
    expect(minimumPlausibleSpeechDurationMs(text, 1.35)).toBe(1_150);
    expect(minimumPlausibleSpeechDurationMs('Three brief words')).toBe(600);
  });

  it('tempo-corrects a near miss but rejects severely rambling speech', () => {
    const text = 'One two three four five six seven eight';
    expect(maximumPlausibleSpeechDurationMs(text)).toBe(5_400);
    expect(speechTempoCorrection(text, 6_680)).toBeCloseTo(1.336, 3);
    expect(speechTempoCorrection(text, 20_000)).toBeNull();
  });

  it('compresses a drawn-out interjection instead of accepting four seconds for one word', () => {
    expect(maximumPlausibleSpeechDurationMs('Stop!')).toBe(3_000);
    expect(speechTempoCorrection('Stop!', 4_600)).toBeCloseTo(1.769, 3);
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
