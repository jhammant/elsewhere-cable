import { describe, expect, it } from 'vitest';
import type { GeneratedSegmentDraft } from '@elsewhere-cable/schemas';
import { noveltyIssues, recordFromDraft } from './novelty.js';

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
});
