import { describe, expect, it } from 'vitest';
import type { GeneratedSegmentDraft } from '@elsewhere-cable/schemas';
import {
  conceptNoveltyIssues,
  dialogueNoveltyIssues,
  noveltyIssues,
  recordFromDraft,
  segmentNoveltyIssues,
} from './novelty.js';

function candidate(overrides: Partial<GeneratedSegmentDraft> = {}): GeneratedSegmentDraft {
  return {
    channelNumber: 9_876_543_210,
    channelName: 'Unfamiliar Channel',
    programmeTitle: 'A New Programme',
    format: 'ident',
    realityId: 'TEST-NEW',
    visualStyle: 'test',
    visualMedium: 'paper_cutout',
    castArchetype: 'mixed',
    premise: 'A cupboard applies for permission to become a coastline.',
    tone: ['dry'],
    dialogue: [
      { speaker: 'A', text: 'The tide has completed its paperwork.', action: 'IDLE' },
      { speaker: 'B', text: 'The shelf is waiting outside.', action: 'LOOK_AT' },
      { speaker: 'C', text: 'No hinges were consulted.', action: 'POINT_AT' },
      { speaker: 'D', text: 'Then approve the salt.', action: 'FREEZE' },
    ],
    continuityFact: 'Cupboards can request coastal status.',
    endingBeat: 'A wave files itself alphabetically.',
    ...overrides,
  };
}

describe('creative novelty', () => {
  it('rejects repeated premises and dialogue even when punctuation changes', () => {
    const previous = candidate();
    const repeated = candidate({
      programmeTitle: 'Different title',
      premise: 'A cupboard applies for permission to become a coastline!',
      dialogue: [
        { speaker: 'Z', text: 'The tide has completed its paperwork!', action: 'IDLE' },
        { speaker: 'B', text: 'Everything else is new.', action: 'LOOK_AT' },
        { speaker: 'C', text: 'Nothing familiar remains.', action: 'POINT_AT' },
        { speaker: 'D', text: 'End transmission.', action: 'FREEZE' },
      ],
    });

    expect(noveltyIssues(repeated, [recordFromDraft(previous)])).toEqual(
      expect.arrayContaining([
        expect.stringContaining('premise resembles'),
        expect.stringContaining('dialogue resembles'),
      ]),
    );
  });

  it('accepts an unrelated creative rule', () => {
    const previous = candidate();
    const fresh = candidate({
      programmeTitle: 'The Borrowed Horizon',
      premise: 'A lighthouse rents its beam to a shy underground station.',
      dialogue: [
        { speaker: 'Lamp', text: 'The platform requested one portable dawn.', action: 'IDLE' },
        { speaker: 'Rail', text: 'Commuters are wearing seaside expressions.', action: 'LOOK_AT' },
        { speaker: 'Lamp', text: 'Collect the light before the gulls arrive.', action: 'POINT_AT' },
        { speaker: 'Rail', text: 'The tunnel has already begun sparkling.', action: 'FREEZE' },
      ],
    });

    expect(noveltyIssues(fresh, [recordFromDraft(previous)])).toEqual([]);
  });

  it('does not mistake generic short reactions for repeated jokes', () => {
    const history = [
      {
        title: 'Previous Programme',
        premise: 'A previous premise.',
        dialogue: ['No.', 'Yes!', 'Fine then.', 'Normality will not resume.'],
      },
    ];

    expect(
      dialogueNoveltyIssues([{ text: 'No!' }, { text: 'Yes.' }, { text: 'Fine, then.' }], history),
    ).toEqual([]);
    expect(dialogueNoveltyIssues([{ text: 'Normality will not resume!' }], history)).toEqual([
      'dialogue resembles "Normality will not resume."',
    ]);
  });

  it('rejects the same joke mechanism moved into a different setting', () => {
    const previous = candidate({
      premise:
        'Island shoppers receive an award for preventing the event currently happening on their ferry.',
    });
    const relocated = candidate({
      programmeTitle: 'A Different Award',
      premise:
        'Factory trainees hold a trophy for preventing the event currently happening on their loading dock.',
    });

    expect(noveltyIssues(relocated, [recordFromDraft(previous)])).toEqual(
      expect.arrayContaining([expect.stringContaining('premise reuses the phrase')]),
    );
  });

  it('does not exhaust a large catalogue on short generator scaffold phrases', () => {
    const history = Array.from({ length: 193 }, (_, index) => ({
      title: `Programme ${index}`,
      premise: `At location ${index}, the music stops without warning and object ${index} folds.`,
      dialogue: [],
    }));
    const fresh = candidate({
      premise:
        'Inside a rotating kiln, the music stops without warning and every clay judge trades height with a trophy.',
    });

    expect(noveltyIssues(fresh, history)).toEqual([]);
  });

  it('allows a production set to recur when the comic mechanism changes', () => {
    const previous = candidate({
      programmeTitle: 'Last Order Please',
      premise:
        'At a local utilities bunker with an excessively polite spokesperson, a warning caption promotes whoever apologises last.',
    });
    const fresh = candidate({
      programmeTitle: 'The Borrowed Extension Lead',
      premise:
        'At a local utilities bunker with an excessively polite spokesperson, a caller sells spare electricity to a homesick desk lamp.',
    });

    expect(conceptNoveltyIssues(fresh, [recordFromDraft(previous)])).toEqual([]);
  });

  it('rejects a paraphrased repeat of the same broadcast-graphic credit mechanism', () => {
    const previous = candidate({
      programmeTitle: 'Thank the Logo',
      premise:
        'In a continuity ident, an announcer wants the next title displayed, but the network logo refuses to leave until its full name is thanked aloud.',
    });
    const paraphrase = candidate({
      programmeTitle: 'Station Transition Alpha',
      premise:
        'In an empty studio, an announcer tries to conclude the ident while a logo refuses to rotate unless it receives top billing.',
    });

    expect(noveltyIssues(paraphrase, [recordFromDraft(previous)])).toContain(
      'comic mechanism repeats "broadcast graphic demands credit before moving"',
    );
  });

  it('rejects the same labour-credit sketch when the appliance and setting change', () => {
    const previous = candidate({
      programmeTitle: "The Kettle's Union",
      premise:
        'At a suburban lunch, a host advertises a kettle that refuses to boil until the neighbour admits its unpaid labor role.',
    });
    const disguisedRepeat = candidate({
      programmeTitle: 'The Silent Sales Pitch',
      premise:
        'At a village demonstration, a magician advertises a vacuum machine that refuses to sell unless he acknowledges the driver who works for free.',
    });

    expect(noveltyIssues(disguisedRepeat, [recordFromDraft(previous)])).toContain(
      'comic mechanism repeats "object withholds service until hidden worker receives credit"',
    );
  });

  it('rejects another talking product negotiating working conditions before it functions', () => {
    const previous = candidate({
      programmeTitle: 'The Uncooperative Receipt',
      premise:
        'At a pharmacy counter, a spokesperson must sell a sentient receipt, but it refuses to show its price until granted health insurance.',
    });
    const disguisedRepeat = candidate({
      programmeTitle: 'The Receipt Refusal',
      premise:
        'In a ferry cafeteria, an inventor demonstrates a thermal mug while its talking receipt withholds the total unless it receives a permanent chair contract.',
    });

    expect(noveltyIssues(disguisedRepeat, [recordFromDraft(previous)])).toContain(
      'comic mechanism repeats "object negotiates working conditions before functioning"',
    );
  });

  it('rechecks a packaged segment against the catalogue before publication', () => {
    const previous = candidate({
      programmeTitle: 'The Uncooperative Receipt',
      premise:
        'At a pharmacy counter, a spokesperson must sell a sentient receipt, but it refuses to show its price until granted health insurance.',
    });
    const packaged = {
      schemaVersion: 1 as const,
      segmentId: 'seg_receipt_refusal',
      channel: {
        id: 'channel_ferry_cafe',
        number: 8_118_440_004,
        name: 'Ferry Cafeteria Demonstrations',
        realityId: 'FERRY-11',
      },
      programme: {
        id: 'programme_receipt_refusal',
        title: 'The Receipt Refusal',
        format: 'shopping' as const,
        premise:
          'In a ferry cafeteria, an inventor demonstrates a thermal mug while its talking receipt withholds the total unless it receives a permanent chair contract.',
      },
      durationMs: 20_000,
      visualStyle: 'flat_cutout' as const,
      tone: ['dry', 'surreal'],
      events: [
        {
          atMs: 1_000,
          type: 'speech.play' as const,
          speechId: 'speech_receipt',
          characterId: 'receipt',
          characterName: 'Receipt',
          voiceId: 'voice_receipt',
          subtitle: 'No chair contract, no total.',
          audioFile: 'audio/speech_receipt.wav',
          durationMs: 1_500,
        },
      ],
      continuityUpdates: [],
      suggestedExit: {
        earliestMs: 15_000,
        preferredMs: 19_000,
        transition: 'STATIC_BURST' as const,
      },
      production: {
        generatedAt: new Date(0).toISOString(),
        generator: 'test',
        model: 'test',
        safetyStatus: 'approved-for-local-preview' as const,
        audioPrepared: true,
      },
    };

    expect(segmentNoveltyIssues(packaged, [recordFromDraft(previous)])).toContain(
      'comic mechanism repeats "object negotiates working conditions before functioning"',
    );
  });
});
