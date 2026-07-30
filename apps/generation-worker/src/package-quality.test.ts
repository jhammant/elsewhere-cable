import { describe, expect, it } from 'vitest';
import { segmentPackageSchema, type SegmentPackage } from '@elsewhere-cable/schemas';
import { legacyPackageQualityIssues } from './package-quality.js';

function packageWithDialogue(premise: string, subtitles: string[]): SegmentPackage {
  return segmentPackageSchema.parse({
    schemaVersion: 1,
    segmentId: 'seg_quality_test',
    channel: {
      id: 'channel_quality',
      number: 8_281_044,
      name: 'Quality Eight',
      realityId: 'REALITY-QUALITY',
    },
    programme: {
      id: 'programme_quality',
      title: 'A Legible Disagreement',
      format: 'public_access',
      premise,
    },
    durationMs: 30_000,
    visualStyle: 'flat_cutout',
    tone: ['dry', 'surreal'],
    events: subtitles.map((subtitle, index) => ({
      atMs: index * 2_000,
      type: 'speech.play' as const,
      speechId: `speech_${String(index).padStart(2, '0')}`,
      characterId: index % 2 === 0 ? 'host' : 'guest',
      characterName: index % 2 === 0 ? 'Host' : 'Guest',
      voiceId: index % 2 === 0 ? 'voice_a' : 'voice_b',
      subtitle,
      audioFile: `audio/speech_${String(index).padStart(2, '0')}.wav`,
      durationMs: 1_000,
    })),
    continuityUpdates: [],
    suggestedExit: {
      earliestMs: 20_000,
      preferredMs: 28_000,
      transition: 'STATIC_BURST',
    },
    production: {
      generatedAt: new Date(0).toISOString(),
      generator: 'test',
      model: 'test',
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: true,
    },
  });
}

describe('legacy package quality', () => {
  it('accepts a coherent harmless disagreement', () => {
    const segment = packageWithDialogue(
      'At a lost-property desk, an umbrella refuses collection until its owner apologises for leaving it on a bus.',
      [
        'I have your receipt and would like my umbrella back.',
        'It heard what you called it on the number forty bus.',
        'That was rain talking, not me.',
        'Then apologise to the handle, which took it personally.',
      ],
    );

    expect(legacyPackageQualityIssues(segment)).toEqual([]);
  });

  it('does not treat a failing signal as bodily harm', () => {
    const segment = packageWithDialogue(
      'At a continuity desk, an engineer wants two shapes to overlap before the network logo appears.',
      [
        'Move left until your corner meets mine.',
        'I am already touching the centre point.',
        'If the shapes separate again, the signal dies.',
        'Then keep the logo exactly where it is.',
      ],
    );

    expect(legacyPackageQualityIssues(segment)).toEqual([]);
  });

  it('allows harmless bureaucratic scheduling of fictional panic', () => {
    const segment = packageWithDialogue(
      'At an emergency desk, a bulletin schedules public panic several days in advance.',
      [
        'A serious event is expected yesterday and will reach you on Thursday.',
        'Citizens assigned to Wednesday should remain mildly concerned.',
        'Do not panic early; it invalidates your emergency window.',
        'Late panic may be carried into next month.',
      ],
    );

    expect(legacyPackageQualityIssues(segment)).toEqual([]);
  });

  it('rejects bodily harm in an old prepared package', () => {
    const segment = packageWithDialogue(
      'At a game-show desk, the host asks a contestant to answer one question.',
      [
        'Choose the left button.',
        'The chair will crush the contestant.',
        'I refuse to play.',
        'The audience has voted.',
      ],
    );

    expect(legacyPackageQualityIssues(segment)).toEqual(
      expect.arrayContaining([expect.stringContaining('legacy safety check rejected')]),
    );
  });

  it('rejects action narration and unrelated mechanism drift', () => {
    const segment = packageWithDialogue(
      'At a weather desk, a presenter wants a cloud to admit it has hidden the forecast.',
      [
        'I am pointing at the cloud behind the map.',
        'I am holding the forecast beside the desk.',
        'The map is flattening into the floor.',
        'Now the cloud is shrinking into a telephone.',
      ],
    );

    expect(legacyPackageQualityIssues(segment)).toEqual(
      expect.arrayContaining([
        'dialogue narrates physical stage actions instead of performing them',
        expect.stringContaining('unrelated surreal mechanisms'),
      ]),
    );
  });

  it('rejects a physical ending direction exposed as an on-screen graphic', () => {
    const segment = packageWithDialogue(
      'At a shopping desk, a host wants a mug to sign a co-host agreement.',
      [
        'Please sign the small co-host agreement.',
        'Only after my handle receives its own chair.',
        'The chair is listed in the revised contract.',
        'Then I accept this extremely modest promotion.',
      ],
    );
    segment.events.push({
      atMs: 18_000,
      type: 'graphic.show',
      graphic: 'WARNING',
      text: 'The host is permanently fused inside the counter while the mug applauds.',
    });

    expect(legacyPackageQualityIssues(segment)).toContain(
      'on-screen graphic narrates a physical stage direction',
    );
  });

  it('rejects cruelty and bodily entrapment as comedy shortcuts', () => {
    const segment = packageWithDialogue(
      'At an art desk, two presenters compete to select the most persuasive shade of ink.',
      [
        'I am trying not to laugh at your panic.',
        'The rule requires aggression when you choose blue.',
        'I have selected green because it matches the desk.',
        'Now the guest is pinned beneath the display plinth.',
      ],
    );

    expect(legacyPackageQualityIssues(segment)).toEqual(
      expect.arrayContaining([
        'dialogue uses cruelty or humiliation as a shortcut for comedy',
        'dialogue uses bodily entrapment instead of a harmless comic consequence',
      ]),
    );
  });

  it('rejects repeated peril and rule recital before it reaches air', () => {
    const segment = packageWithDialogue(
      'At a horizon-painting class, a dancer wants the host to relinquish ownership of the colour blue.',
      [
        'The rules state ownership transfers upon eye contact.',
        'I am trapped in this corner, please stop.',
        'The rules state we must move to the new surface.',
        'Do not look at me while you quote them.',
        'The rules state I must maintain eye contact.',
        'The horizon became the ceiling and I am falling into the studio.',
      ],
    );

    expect(legacyPackageQualityIssues(segment)).toEqual(
      expect.arrayContaining([
        'dialogue is dominated by generic peril rather than comic conflict',
        'characters repeatedly explain the rule instead of pursuing a comic goal',
      ]),
    );
  });

  it('rejects arbitrary character transformations while preserving social status changes', () => {
    const transformed = packageWithDialogue(
      'During a sports bulletin, every correction shifts the subject identity onto the speaker.',
      [
        'The Silver Bears actually won this game.',
        'Correction: you are now a clumsy bear yourself.',
        'I am the anchor, not a bear.',
        'Correction: the anchor is now a silver trophy.',
      ],
    );
    const promoted = packageWithDialogue(
      'During a sports bulletin, the quiet witness receives authority whenever the anchor guesses.',
      [
        'The Silver Bears actually won this game.',
        'That correction gives you the final decision.',
        'I accept the promotion with professional reluctance.',
        'Then please finish the bulletin from my chair.',
      ],
    );

    expect(legacyPackageQualityIssues(transformed)).toContain(
      'characters arbitrarily transform instead of pursuing a coherent comic goal',
    );
    expect(legacyPackageQualityIssues(promoted)).toEqual([]);
  });
});
