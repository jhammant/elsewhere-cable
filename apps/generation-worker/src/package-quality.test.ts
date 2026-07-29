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
});
