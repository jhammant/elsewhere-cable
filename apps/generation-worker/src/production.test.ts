import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generatedSegmentProposalSchema,
  playoutManifestSchema,
  segmentPackageSchema,
} from '@elsewhere-cable/schemas';
import { demoDraft, scriptPrompt, visualMediumForStyle, visualStyleForMedium } from './creative.js';
import {
  assertPreviewSafe,
  editorialCritiqueIssues,
  midSpeechCameraEvents,
  openingGraphicForFormat,
  preparedScriptFailureIsQuarantinable,
  produceBatch,
  previewSafetyIssues,
  proposalCritiqueIssues,
  proposalQualityIssues,
  repairNetworkIdentityCollision,
  semanticNoveltyIssue,
  speechTurnsForTts,
  storyGraphicForFormat,
  transitionsForSegment,
} from './production.js';
import type { LlmProvider, SpeechRequest, SpeechResult, TtsProvider } from './providers.js';

const temporaryDirectories: string[] = [];

function universallyAlignedProposal(draft: ReturnType<typeof demoDraft>) {
  const programmeIdentity = draft.programmeTitle.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  const premise =
    draft.channelNumber % 2 === 0
      ? `During ${programmeIdentity}, an emergency news programme, a refrigerator wants a worker to offer its service, but the family customer refuses permission until a spoken contract transfers status and the studio camera moves.`
      : `At ${programmeIdentity}, a live community workplace channel, a worker's meeting minutes want to sell a news product, yet the customer refuses social permission; an emergency spoken contract reassigns rank whenever the studio camera rotates.`;
  return generatedSegmentProposalSchema.parse({
    ...draft,
    premise,
    endingBeat: 'The customer signs the contract as the camera holds on the product.',
  });
}

function architectureAlignedDialogue(
  draft: ReturnType<typeof demoDraft>,
  proposal: ReturnType<typeof universallyAlignedProposal>,
) {
  let dialogueCount = {
    frantic: 10,
    staccato: 8,
    conversational: 6,
    slow_burn: 6,
    interrupted: 4,
    near_silent: 4,
  }[proposal.pacing ?? 'conversational'];
  const prompt = scriptPrompt(proposal);
  if (prompt.includes('Dialogue architecture: Rapid corrections:')) {
    dialogueCount = Math.max(8, dialogueCount);
  }
  if (prompt.includes('Dialogue architecture: Sparse reaction scene:')) {
    dialogueCount = Math.min(6, dialogueCount);
  }
  const programmeToken =
    proposal.programmeTitle.match(/[A-Za-z]{4,}/u)?.[0] ?? `Channel${proposal.channelNumber}`;
  return Array.from({ length: dialogueCount }, (_, index) => ({
    ...draft.dialogue[index % draft.dialogue.length]!,
    speaker: index % 4 < 2 ? 'Host' : 'Guest',
    text: `${programmeToken} marks short response number ${index + 1} clearly.`,
    action:
      index < 2
        ? ('PAUSE' as const)
        : draft.dialogue[index % draft.dialogue.length]!.action === 'IDLE'
          ? ('REACTION_NEUTRAL' as const)
          : draft.dialogue[index % draft.dialogue.length]!.action,
  }));
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('produceBatch', () => {
  it('uses format-specific information graphics without displaying stage directions', () => {
    const sequences = (
      ['advert', 'public_access', 'news', 'shopping', 'sitcom', 'emergency', 'ident'] as const
    ).map((format) => ({
      format,
      opening: openingGraphicForFormat(format),
      midpoint: storyGraphicForFormat(format),
    }));

    expect(sequences).toContainEqual({
      format: 'emergency',
      opening: 'WARNING',
      midpoint: 'TITLE_CARD',
    });
    expect(sequences).toContainEqual({
      format: 'news',
      opening: 'LOWER_THIRD',
      midpoint: 'TITLE_CARD',
    });
    expect(sequences.every(({ opening, midpoint }) => opening !== midpoint)).toBe(true);
    expect(new Set(sequences.map(({ opening, midpoint }) => `${opening}:${midpoint}`)).size).toBe(
      4,
    );
  });

  it('varies compatible channel transitions across format and pacing', () => {
    const pairs = (
      [
        ['advert', 'frantic', 8_429_105_736],
        ['public_access', 'near_silent', 894_210_573],
        ['news', 'staccato', 73_118_402],
        ['shopping', 'conversational', 9_701_442_880],
        ['sitcom', 'slow_burn', 551_902_741],
        ['emergency', 'interrupted', 6_000_401_991],
        ['ident', 'near_silent', 407_118_650],
      ] as const
    ).map(([format, pacing, channelNumber]) =>
      transitionsForSegment(format, pacing, channelNumber),
    );

    expect(new Set(pairs.flatMap(({ opening, ending }) => [opening, ending])).size).toBe(4);
    expect(pairs.every(({ opening, ending }) => opening !== ending)).toBe(true);
  });

  it('adds visual beats to long energetic speech while preserving deliberate holds', () => {
    expect(midSpeechCameraEvents(1_000, 5_000, 'frantic', 0)).toEqual([
      { atMs: 2_700, type: 'camera.cut', camera: 'CAMERA_WIDE' },
      { atMs: 4_500, type: 'camera.cut', camera: 'CAMERA_GUEST' },
    ]);
    expect(midSpeechCameraEvents(1_000, 3_000, 'conversational', 1)).toEqual([
      { atMs: 2_620, type: 'camera.cut', camera: 'CAMERA_WIDE' },
    ]);
    expect(midSpeechCameraEvents(1_000, 5_000, 'slow_burn', 0)).toEqual([]);
  });

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

  it('requires the proposal critic to approve one causal stageable story', () => {
    expect(
      proposalCritiqueIssues({
        accepted: true,
        clarity: 8,
        mechanismIntegrity: 8,
        endingCausality: 8,
        stageability: 8,
        comedyPotential: 7,
        issues: [],
      }),
    ).toEqual([]);
    expect(
      proposalCritiqueIssues({
        accepted: false,
        clarity: 7,
        mechanismIntegrity: 6,
        endingCausality: 3,
        stageability: 7,
        comedyPotential: 6,
        issues: ['The ending introduces an unrelated kitchen certificate.'],
      }),
    ).toEqual(['proposal critic: The ending introduces an unrelated kitchen certificate.']);
  });

  it('does not spend script attempts on a proposal whose ending critic rejects it', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-proposal-critic-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');
    let proposalCalls = 0;
    let proposalCriticCalls = 0;
    let scriptCalls = 0;
    const llm: LlmProvider = {
      id: 'proposal-critic-test-llm',
      model: 'test-model',
      generateProposal() {
        const proposal = universallyAlignedProposal(demoDraft(proposalCalls));
        proposalCalls += 1;
        return Promise.resolve(proposal);
      },
      critiqueProposal() {
        proposalCriticCalls += 1;
        return Promise.resolve({
          accepted: false,
          clarity: 8,
          mechanismIntegrity: 8,
          endingCausality: 3,
          stageability: 8,
          comedyPotential: 7,
          issues: ['The ending introduces an unrelated kitchen certificate.'],
        });
      },
      generateStructured(request) {
        scriptCalls += 1;
        const proposalJson = request.userPrompt.match(
          /Turn this already approved proposal into a complete comedy segment:\n(\{.*\})\n\nPreserve/u,
        )?.[1];
        const proposal = generatedSegmentProposalSchema.parse(JSON.parse(proposalJson ?? '{}'));
        const draft = demoDraft(1);
        return Promise.resolve({
          ...draft,
          dialogue: architectureAlignedDialogue(draft, proposal),
        });
      },
      critiqueDraft() {
        return Promise.resolve({
          accepted: true,
          coherence: 8,
          comedyEscalation: 8,
          dialogueNaturalness: 8,
          endingEarned: 8,
          issues: [],
        });
      },
    };

    await expect(
      produceBatch({
        count: 1,
        concurrency: 1,
        outputRoot,
        demo: false,
        llm,
        tts: null,
        embeddingProvider: null,
        scriptQueueRoot,
        prepareScriptsOnly: true,
      }),
    ).rejects.toThrow('Could not produce a novel premise after 16 attempts');

    expect(proposalCalls).toBe(16);
    expect(proposalCriticCalls).toBeGreaterThan(0);
    expect(proposalCriticCalls).toBeLessThan(proposalCalls);
    expect(scriptCalls).toBe(0);
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

  it('rejects a vague semantic contract and renderer leakage in its ending', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      storyMode: 'semantic_contract',
      visualMedium: 'stained_glass',
      visualStyle: 'luminous_leaded_stained_glass_panels',
      premise:
        'At a village-hall demonstration, a resident needs to leave, but one spoken phrase forces them into an incompatible obligation.',
      endingBeat:
        'The resident accepts the incompatible obligation while maintaining the terminal cursor position.',
    });

    expect(proposalQualityIssues(proposal)).toEqual(
      expect.arrayContaining([
        'semantic-contract premise must name the actual phrase and its concrete harmless obligation',
        'ending leaks an unrelated renderer instruction into the story payoff',
      ]),
    );
  });

  it('recognises curated story-mode wording without requiring validator shibboleths', () => {
    const statusTransfer = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      programmeTitle: 'The Final Choice',
      storyMode: 'status_transfer',
      premise:
        'In a workplace bulletin, an anchor wants the Final Choice settled, but it belongs to the colleague whose preferred result creates extra work for them.',
      endingBeat: 'The colleague accepts the final choice and the anchor records the extra work.',
    });
    const formatLiteralism = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(1)),
      programmeTitle: 'The Commercial Break',
      storyMode: 'format_literalism',
      premise:
        'During a news report, an anchor wants the Commercial Break delayed, but it pauses only the duties of the colleague currently selling the shared mug.',
      endingBeat: 'The colleague stops selling the mug and resumes the paused duty.',
    });
    const socialProtocol = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(2)),
      programmeTitle: 'The Farewell',
      storyMode: 'social_protocol',
      premise:
        'At a household Farewell, one neighbour wants to leave, but it remains incomplete until the quiet roommate accepts one practical favour.',
      endingBeat: 'The roommate accepts the favour and completes the farewell.',
    });
    const newFormatLiteralism = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(3)),
      programmeTitle: 'The Final Countdown',
      storyMode: 'format_literalism',
      premise:
        'In a continuity booth, an announcer wants to leave, but the final countdown assigns every remaining second to an unfinished household task.',
      endingBeat: 'The announcer completes the last task and allows the countdown to finish.',
    });
    const newSocialProtocol = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(4)),
      programmeTitle: 'The Helpful Complaint',
      storyMode: 'social_protocol',
      premise:
        'At a household advice desk, a neighbour wants to complain, but the protocol allows a complaint only while its target performs one small kindness.',
      endingBeat: 'The neighbour accepts the kindness and makes one precise complaint.',
    });
    const ordinaryObjectAgency = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(5)),
      programmeTitle: 'The Button Hearing',
      storyMode: 'object_agency',
      premise:
        'At a community hearing, a button in a jar wants one day under its borrower’s ordinary name before accepting a permanent label.',
      endingBeat: 'The borrower supplies the name and the button accepts the temporary label.',
    });

    expect(proposalQualityIssues(statusTransfer)).not.toContain(
      'premise does not realise its assigned status_transfer story mode',
    );
    expect(proposalQualityIssues(formatLiteralism)).not.toContain(
      'premise does not realise its assigned format_literalism story mode',
    );
    expect(proposalQualityIssues(socialProtocol)).not.toContain(
      'premise does not realise its assigned social_protocol story mode',
    );
    expect(proposalQualityIssues(newFormatLiteralism)).not.toContain(
      'premise does not realise its assigned format_literalism story mode',
    );
    expect(proposalQualityIssues(newSocialProtocol)).not.toContain(
      'premise does not realise its assigned social_protocol story mode',
    );
    expect(proposalQualityIssues(ordinaryObjectAgency)).not.toContain(
      'object-agency premise must give the object its own explicit demand or refusal',
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

  it('recognises ordinary broadcast language as format literalism', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      format: 'ident',
      storyMode: 'format_literalism',
      premise:
        'In a continuity booth, an announcer wants to finish the broadcast, but the scheduler refuses because its caption contractually demands closing credit.',
      endingBeat: 'The announcer grants the caption closing credit and completes the broadcast.',
    });

    expect(proposalQualityIssues(proposal)).not.toContain(
      'premise does not realise its assigned format_literalism story mode',
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

  it('rejects an unrelated title and realistic safety language in emergency comedy', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      format: 'emergency',
      programmeTitle: 'The Kelp Forest Safety Briefing',
      storyMode: 'social_protocol',
      premise:
        'During a public warning in a glass-bottomed boxing gym, a light wants to help a caretaker, but an announcer refuses its protocol.',
      endingBeat: 'The light issues dangerously slippery safety instructions before it bows.',
    });

    expect(proposalQualityIssues(proposal)).toEqual(
      expect.arrayContaining([
        'programme title promises a distinctive subject absent from the premise',
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

  it('rejects identity transformations outside the visual-physics story mode', () => {
    const proposal = generatedSegmentProposalSchema.parse({
      ...universallyAlignedProposal(demoDraft(0)),
      format: 'news',
      storyMode: 'format_literalism',
      programmeTitle: 'The Silver Cup Bulletin',
      premise:
        'During a sports news bulletin, an anchor wants to name a winner, but every correction shifts the subject identity onto the speaker.',
      endingBeat: 'The anchor stops correcting while their image remains a silver trophy.',
    });

    expect(proposalQualityIssues(proposal)).toContain(
      'non-visual story mode introduces an automatic body or set transformation',
    );
  });

  it('rejects dialogue that narrates an unapproved automatic prop transformation', () => {
    const draft = {
      ...universallyAlignedProposal(demoDraft(0)),
      storyMode: 'status_transfer' as const,
      dialogue: demoDraft(0).dialogue.map((line, index) => ({
        ...line,
        text: index === 0 ? 'There it goes. The tablecloth folds itself instantly.' : line.text,
      })),
    };

    expect(proposalQualityIssues(draft)).toContain(
      'spoken dialogue narrates an unapproved automatic transformation the renderer cannot perform',
    );
  });

  it('rejects cruel or graphic harm before preparing speech', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = 'The harness is choking the contestant until they drop dead.';

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('returns preview safety defects early enough for a script retry', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = 'The dead appliance has submitted another camera direction.';

    expect(previewSafetyIssues(draft)).toEqual([
      expect.stringContaining('Local-preview safety check rejected content matching'),
    ]);
  });

  it('rejects bereavement and bodily harm as shortcuts for comedy stakes', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = "My cat's passing left the body still warm.";

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('rejects grief and identity erasure anywhere in package metadata', () => {
    const griefDraft = demoDraft(0);
    griefDraft.premise =
      'At a shopping desk, a host sells permanent grief after a customer lost their cat.';
    expect(() => assertPreviewSafe(griefDraft)).toThrow('safety check rejected');

    const erasureDraft = demoDraft(1);
    erasureDraft.continuityFact = 'The product causes social erasure of its previous owner.';
    expect(() => assertPreviewSafe(erasureDraft)).toThrow('safety check rejected');
  });

  it('rejects permanent or total social isolation as a comedy objective', () => {
    const draft = demoDraft(1);
    draft.premise =
      'At a community advice desk, a resident wants social isolation, while the host offers a neighbourly compromise.';
    draft.dialogue[0]!.text = 'I would rather hide from everyone than answer another caller.';

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('rejects memory or personality deletion presented as a consumer benefit', () => {
    const draft = demoDraft(0);
    draft.premise =
      'At a software advert desk, a salesperson sells an update that deletes your personality and wipes all core memories.';

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('rejects animal attacks as a shortcut for surreal stakes', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = 'The sharks eat whoever stands in their tank.';

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('rejects deliberate reputation damage as a comic objective', () => {
    const draft = demoDraft(0);
    draft.dialogue[0]!.text = 'I received an order to ruin your reputation.';

    expect(() => assertPreviewSafe(draft)).toThrow('safety check rejected');
  });

  it('rejects coercive entrapment and breath restriction as comedy stakes', () => {
    const trappedDraft = demoDraft(0);
    trappedDraft.dialogue[0]!.text = 'The guest is pinned beneath the dryer forever.';
    expect(() => assertPreviewSafe(trappedDraft)).toThrow('safety check rejected');

    const breathDraft = demoDraft(1);
    breathDraft.dialogue[0]!.text = 'Stop breathing until the furniture becomes stable.';
    expect(() => assertPreviewSafe(breathDraft)).toThrow('safety check rejected');
  });

  it('rejects studio explosions, blood and sharp objects as escalation', () => {
    const explosionDraft = demoDraft(0);
    explosionDraft.endingBeat = 'The timer explodes the studio during the final offer.';
    expect(() => assertPreviewSafe(explosionDraft)).toThrow('safety check rejected');

    const injuryDraft = demoDraft(1);
    injuryDraft.dialogue[0]!.text = 'I practised until my nose bled on the jagged metal.';
    expect(() => assertPreviewSafe(injuryDraft)).toThrow('safety check rejected');
  });

  it('rejects forced dust exposure, human trapping and permanent relationship loss', () => {
    const dustDraft = demoDraft(0);
    dustDraft.dialogue[0]!.text = 'The service will fill our throats with dust.';
    expect(() => assertPreviewSafe(dustDraft)).toThrow('safety check rejected');

    const trappedDraft = demoDraft(1);
    trappedDraft.premise =
      "At a recording booth, the service traps the resident's reunion guest in silence.";
    expect(() => assertPreviewSafe(trappedDraft)).toThrow('safety check rejected');

    const isolationDraft = demoDraft(2);
    isolationDraft.dialogue[0]!.text = 'This procedure will end our relationship forever.';
    expect(() => assertPreviewSafe(isolationDraft)).toThrow('safety check rejected');
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

  it('packages separate TTS turns for each sentence without dropping spoken words', () => {
    const dialogue = [
      {
        speaker: 'Neighbour B',
        text: 'Clearly. My reservation is purely theoretical and void of hunger.',
        action: 'POINT_AT' as const,
      },
      {
        speaker: 'Neighbour A',
        text: 'Then the empty booth is mine.',
        action: 'LOOK_AT' as const,
      },
    ];

    const turns = speechTurnsForTts(dialogue);

    expect(turns.map((turn) => turn.text)).toEqual([
      'Clearly.',
      'My reservation is purely theoretical and void of hunger.',
      'Then the empty booth is mine.',
    ]);
    expect(turns.map((turn) => turn.speaker)).toEqual([
      'Neighbour B',
      'Neighbour B',
      'Neighbour A',
    ]);
    expect(
      turns.flatMap((turn) => turn.text.toLowerCase().match(/[\p{L}\p{N}]+/gu)).join(' '),
    ).toBe(dialogue.flatMap((turn) => turn.text.toLowerCase().match(/[\p{L}\p{N}]+/gu)).join(' '));
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
    const authoredMedium = visualMediumForStyle(firstSegment.visualStyle);
    expect(authoredMedium).not.toBeNull();
    expect(firstSegment.visualStyle).toBe(visualStyleForMedium(authoredMedium!));
    expect(firstSegment.castArchetype).toBeDefined();
    const storyGraphic = firstSegment.events.find(
      (event) => event.type === 'graphic.show' && event.text !== firstSegment.programme.title,
    );
    expect(storyGraphic).toBeDefined();
    expect(storyGraphic?.type === 'graphic.show' ? storyGraphic.text : '').not.toContain(
      'camera holds',
    );
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

  it('publishes a finished script without waiting for a slower batch sibling', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-streaming-script-queue-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');
    let proposalCalls = 0;
    let releaseSecondProposal = (): void => undefined;
    const secondProposalGate = new Promise<void>((resolve) => {
      releaseSecondProposal = resolve;
    });
    const llm: LlmProvider = {
      id: 'streaming-script-test-llm',
      model: 'test-model',
      async generateProposal() {
        const index = proposalCalls;
        proposalCalls += 1;
        if (index === 1) {
          await secondProposalGate;
        }
        return universallyAlignedProposal(demoDraft(index));
      },
      generateStructured(request) {
        const proposalJson = request.userPrompt.match(
          /Turn this already approved proposal into a complete comedy segment:\n(\{.*\})\n\nPreserve/u,
        )?.[1];
        const proposal = generatedSegmentProposalSchema.parse(JSON.parse(proposalJson ?? '{}'));
        const draft = demoDraft(proposal.channelNumber);
        return Promise.resolve({
          ...draft,
          ...proposal,
          dialogue: architectureAlignedDialogue(draft, proposal),
        });
      },
    };

    const production = produceBatch({
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
    try {
      let pendingCount = 0;
      for (let attempt = 0; attempt < 100 && pendingCount === 0; attempt += 1) {
        try {
          pendingCount = (await readdir(path.join(scriptQueueRoot, 'pending'))).filter((file) =>
            file.endsWith('.json'),
          ).length;
        } catch {
          // The first successful worker creates the directory.
        }
        if (pendingCount === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      expect(pendingCount).toBe(1);
    } finally {
      releaseSecondProposal();
    }

    const result = await production;
    expect(result.preparedScriptCount).toBeGreaterThanOrEqual(1);
    expect(await readdir(path.join(scriptQueueRoot, 'pending'))).toHaveLength(
      result.preparedScriptCount,
    );
  });

  it('quarantines a prepared script when every TTS endpoint returns permanent bad audio', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-script-quarantine-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');
    await produceBatch({
      count: 1,
      concurrency: 1,
      outputRoot,
      demo: true,
      llm: null,
      tts: null,
      embeddingProvider: null,
      scriptQueueRoot,
      prepareScriptsOnly: true,
    });
    const tts: TtsProvider = {
      id: 'permanently-bad-audio',
      synthesize() {
        return Promise.reject(
          new Error(
            'All TTS endpoints failed: local-a: speech contains 9000ms silence (80%); local-b: post-processing clipped speech to 1200ms (minimum plausible 2500ms)',
          ),
        );
      },
    };

    await expect(
      produceBatch({
        count: 1,
        concurrency: 1,
        outputRoot,
        demo: false,
        llm: null,
        tts,
        embeddingProvider: null,
        scriptQueueRoot,
        packagePreparedScripts: true,
      }),
    ).rejects.toThrow('Batch produced no approved segment packages');

    expect(await readdir(path.join(scriptQueueRoot, 'pending'))).toHaveLength(0);
    const failedFiles = await readdir(path.join(scriptQueueRoot, 'failed'));
    expect(failedFiles.filter((file) => /^draft_[a-z0-9]+\.json$/u.test(file))).toHaveLength(1);
    expect(failedFiles.filter((file) => file.endsWith('.failure.json'))).toHaveLength(1);
  });

  it('keeps transient TTS failures eligible for a later packaging retry', () => {
    expect(
      preparedScriptFailureIsQuarantinable(
        'speech_00 failed: All TTS endpoints failed: local-a: fetch failed; local-b: HTTP 503',
      ),
    ).toBe(false);
    expect(
      preparedScriptFailureIsQuarantinable(
        'speech_00 failed: All TTS endpoints failed: local-a: speech mean level is inaudible (-54 dB); local-b: implausible 21000ms audio for 8 words (maximum recoverable 10000ms)',
      ),
    ).toBe(true);
  });

  it('retries an unsafe script before the final preparation gate', async () => {
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
        draft.dialogue = architectureAlignedDialogue(draft, proposal);
        if (scriptIndex === 0) {
          draft.dialogue[0]!.text = 'The red label bleeds through the paperwork overnight.';
        }
        scriptIndex += 1;
        return Promise.resolve(draft);
      },
    };

    const result = await produceBatch({
      count: 1,
      concurrency: 1,
      outputRoot,
      demo: false,
      llm,
      tts: null,
      embeddingProvider: null,
      scriptQueueRoot,
      prepareScriptsOnly: true,
    });

    expect(result.preparedScriptCount).toBe(1);
    expect(result.rejectedSegmentCount).toBe(0);
    expect(result.rejectionReasons).toEqual([]);
    expect(scriptIndex).toBeGreaterThanOrEqual(2);
    expect(
      (await readdir(path.join(scriptQueueRoot, 'pending'))).filter((file) =>
        file.endsWith('.json'),
      ),
    ).toHaveLength(1);
  });

  it('reuses an approved premise for another bounded script cycle', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-script-retry-limit-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');
    const draft = demoDraft(0);
    let proposalCalls = 0;
    let scriptCalls = 0;
    const scriptPrompts: string[] = [];
    const llm: LlmProvider = {
      id: 'critic-rejection-test-llm',
      model: 'test-model',
      generateProposal() {
        proposalCalls += 1;
        return Promise.resolve(universallyAlignedProposal(draft));
      },
      generateStructured(request) {
        scriptCalls += 1;
        scriptPrompts.push(request.userPrompt);
        const proposalJson = request.userPrompt.match(
          /Turn this already approved proposal into a complete comedy segment:\n(\{.*\})\n\nPreserve/u,
        )?.[1];
        const proposal = generatedSegmentProposalSchema.parse(JSON.parse(proposalJson ?? '{}'));
        return Promise.resolve({
          ...draft,
          dialogue: architectureAlignedDialogue(draft, proposal),
        });
      },
      critiqueDraft() {
        return Promise.resolve({
          accepted: scriptCalls > 4,
          coherence: scriptCalls > 4 ? 8 : 5,
          comedyEscalation: scriptCalls > 4 ? 8 : 5,
          dialogueNaturalness: scriptCalls > 4 ? 8 : 5,
          endingEarned: scriptCalls > 4 ? 8 : 5,
          issues:
            scriptCalls > 4
              ? []
              : ['The approved premise is not producing a coherent playable scene.'],
        });
      },
    };

    await expect(
      produceBatch({
        count: 1,
        concurrency: 1,
        outputRoot,
        demo: false,
        llm,
        tts: null,
        embeddingProvider: null,
        scriptQueueRoot,
        prepareScriptsOnly: true,
      }),
    ).rejects.toThrow('Could not script approved premise after 4 attempts');
    expect(scriptCalls).toBe(4);
    expect(proposalCalls).toBe(1);
    expect(await readdir(path.join(scriptQueueRoot, 'proposals', 'pending'))).toHaveLength(1);

    const result = await produceBatch({
      count: 1,
      concurrency: 1,
      outputRoot,
      demo: false,
      llm,
      tts: null,
      embeddingProvider: null,
      scriptQueueRoot,
      prepareScriptsOnly: true,
    });

    expect(result.preparedScriptCount).toBe(1);
    expect(scriptCalls).toBe(5);
    expect(proposalCalls).toBe(1);
    expect(scriptPrompts[4]).toContain('Previous-review corrections');
    expect(scriptPrompts[4]).toContain(
      'The approved premise is not producing a coherent playable scene.',
    );
    expect(await readdir(path.join(scriptQueueRoot, 'proposals', 'pending'))).toHaveLength(0);
    expect(
      (await readdir(path.join(scriptQueueRoot, 'pending'))).filter((file) =>
        file.endsWith('.json'),
      ),
    ).toHaveLength(1);
  });

  it('retires an approved premise after three failed script cycles', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-proposal-retirement-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');
    const draft = demoDraft(0);
    let proposalCalls = 0;
    let scriptCalls = 0;
    const llm: LlmProvider = {
      id: 'critic-retirement-test-llm',
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
        return Promise.resolve({
          ...draft,
          dialogue: architectureAlignedDialogue(draft, proposal),
        });
      },
      critiqueDraft() {
        return Promise.resolve({
          accepted: false,
          coherence: 5,
          comedyEscalation: 5,
          dialogueNaturalness: 5,
          endingEarned: 5,
          issues: ['The approved premise is not producing a coherent playable scene.'],
        });
      },
    };
    const run = async () =>
      produceBatch({
        count: 1,
        concurrency: 1,
        outputRoot,
        demo: false,
        llm,
        tts: null,
        embeddingProvider: null,
        scriptQueueRoot,
        prepareScriptsOnly: true,
      });

    await expect(run()).rejects.toThrow('Could not script approved premise after 4 attempts');
    await expect(run()).rejects.toThrow('Could not script approved premise after 4 attempts');
    await expect(run()).rejects.toThrow('Could not script approved premise after 4 attempts');

    expect(proposalCalls).toBe(1);
    expect(scriptCalls).toBe(12);
    expect(await readdir(path.join(scriptQueueRoot, 'proposals', 'pending'))).toHaveLength(0);
    const failedFiles = await readdir(path.join(scriptQueueRoot, 'proposals', 'failed'));
    expect(failedFiles).toHaveLength(1);
    const failed = JSON.parse(
      await readFile(path.join(scriptQueueRoot, 'proposals', 'failed', failedFiles[0]!), 'utf8'),
    ) as { retryCycles: number; lastFailure: string };
    expect(failed.retryCycles).toBe(3);
    expect(failed.lastFailure).toContain('Could not script approved premise after 4 attempts');
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
        if (requestCount <= 16) {
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
    let observedScriptPrompt = '';
    const llm: LlmProvider = {
      id: 'two-stage-test-llm',
      model: 'test-model',
      generateProposal() {
        proposalCalls += 1;
        return Promise.resolve(universallyAlignedProposal(draft));
      },
      generateStructured(request) {
        scriptCalls += 1;
        observedScriptPrompt = request.userPrompt;
        const proposalJson = request.userPrompt.match(
          /Turn this already approved proposal into a complete comedy segment:\n(\{.*\})\n\nPreserve/u,
        )?.[1];
        const proposal = generatedSegmentProposalSchema.parse(JSON.parse(proposalJson ?? '{}'));
        return Promise.resolve({
          ...draft,
          dialogue: architectureAlignedDialogue(draft, proposal),
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
      optimisationBrief: {
        schemaVersion: 1,
        generatedAt: '2026-07-30T02:00:00.000Z',
        windowMinutes: 30,
        sampleSize: 30,
        scores: {
          premiseClarity: 6,
          comedyEscalation: 9,
          dialogueCoherence: 5,
          visualMatch: 8,
          paceVariety: 10,
          originality: 9,
          shareability: 7,
        },
        increaseFormats: ['sitcom'],
        increasePacing: ['interrupted'],
        avoidMotifs: [],
        preserveStrengths: ['surreal visual layering'],
        editorialDirection: 'Make character conflict more immediate.',
        delivery: {
          isLive: true,
          concurrentViewers: 1,
          silenceRatio: 0.18,
          freezeRatio: 0,
          fallbackOccurrences: 0,
        },
      },
    });

    expect(proposalCalls).toBe(1);
    expect(scriptCalls).toBe(1);
    expect(observedScriptPrompt).toContain('Live thirty-minute dialogue corrections');
    expect(observedScriptPrompt).toContain('every reply must answer, challenge or redirect');
    expect(observedScriptPrompt).toContain('by the end of the second spoken line');
    expect(result.segmentCount).toBe(1);
  });

  it('lets a structural retry repair its assigned concept without self-novelty', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'elsewhere-rejected-attempt-history-'));
    temporaryDirectories.push(root);
    const outputRoot = path.join(root, 'segments');
    const scriptQueueRoot = path.join(root, 'scripts');
    const repeated = universallyAlignedProposal(demoDraft(0));
    let proposalCalls = 0;
    let scriptCalls = 0;
    const proposalPrompts: string[] = [];
    const llm: LlmProvider = {
      id: 'rejected-attempt-history-test-llm',
      model: 'test-model',
      generateProposal(request) {
        proposalCalls += 1;
        proposalPrompts.push(request.userPrompt);
        if (proposalCalls === 1) {
          return Promise.resolve({
            ...repeated,
            programmeTitle: repeated.programmeTitle.toUpperCase(),
          });
        }
        return Promise.resolve(repeated);
      },
      generateStructured(request) {
        scriptCalls += 1;
        const proposalJson = request.userPrompt.match(
          /Turn this already approved proposal into a complete comedy segment:\n(\{.*\})\n\nPreserve/u,
        )?.[1];
        const proposal = generatedSegmentProposalSchema.parse(JSON.parse(proposalJson ?? '{}'));
        return Promise.resolve({
          ...proposal,
          dialogue: architectureAlignedDialogue(demoDraft(1), proposal),
        });
      },
    };

    const result = await produceBatch({
      count: 1,
      concurrency: 1,
      outputRoot,
      demo: false,
      llm,
      tts: null,
      embeddingProvider: null,
      scriptQueueRoot,
      prepareScriptsOnly: true,
    });

    expect(result.preparedScriptCount).toBe(1);
    expect(proposalCalls).toBe(2);
    expect(scriptCalls).toBe(1);
    const coordinates = proposalPrompts.map(
      (prompt) =>
        prompt.match(
          /Mandatory creative coordinates[\s\S]*?Use the format-specific scene frame/u,
        )?.[0] ?? '',
    );
    expect(coordinates[1]).toBe(coordinates[0]);
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
