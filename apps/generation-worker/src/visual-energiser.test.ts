import { describe, expect, it } from 'vitest';
import { segmentPackageSchema, type SegmentPackage } from '@elsewhere-cable/schemas';
import { energiseVisualTimeline, remixedPacing } from './visual-energiser.js';

function segment(): SegmentPackage {
  return segmentPackageSchema.parse({
    schemaVersion: 1,
    segmentId: 'seg_visual_energy',
    channel: {
      id: 'channel_visual_energy',
      number: 8_472_930_156,
      name: 'Visual Energy Service',
      realityId: 'REALITY-VISUAL',
    },
    programme: {
      id: 'visual_energy',
      title: 'The Demonstration',
      format: 'shopping',
      premise: 'At a demonstration desk, a host wants a mug to accept a modest co-host contract.',
    },
    durationMs: 28_000,
    visualStyle: 'flat_cutout',
    visualMedium: 'paper_cutout',
    pacing: 'conversational',
    tone: ['dry', 'playful'],
    events: [
      {
        atMs: 550,
        type: 'graphic.show',
        graphic: 'LOWER_THIRD',
        text: 'The Demonstration',
      },
      ...[1_200, 5_800, 10_400, 15_000, 19_600, 24_200].flatMap((atMs, index) => [
        {
          atMs,
          type: 'camera.cut' as const,
          camera: index % 2 === 0 ? ('CAMERA_HOST' as const) : ('CAMERA_GUEST' as const),
        },
        {
          atMs: atMs + 120,
          type: 'speech.play' as const,
          speechId: `speech_${index}`,
          characterId: index % 2 === 0 ? 'host' : 'mug',
          characterName: index % 2 === 0 ? 'Host' : 'Mug',
          voiceId: index % 2 === 0 ? 'voice_host' : 'voice_mug',
          subtitle:
            index % 2 === 0
              ? 'Please sign the small co-host agreement.'
              : 'Only after my handle receives its own chair.',
          audioFile: `audio/speech_${index}.m4a`,
          durationMs: 3_100,
        },
      ]),
      {
        atMs: 26_600,
        type: 'graphic.show',
        graphic: 'WARNING',
        text: 'The host is fused into the counter while the mug applauds.',
      },
    ],
    continuityUpdates: [],
    suggestedExit: {
      earliestMs: 26_000,
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

describe('visual timeline energiser', () => {
  it('replaces narrated action cards with dialogue and adds matched visual beats', () => {
    const result = energiseVisualTimeline(segment(), {
      pacing: 'staccato',
      repairGraphics: true,
    });
    const laterGraphicText = result.segment.events.flatMap((event) =>
      event.type === 'graphic.show' && event.atMs > 1_000 ? [event.text] : [],
    );

    expect(result.pacingChanged).toBe(true);
    expect(result.repairedGraphics).toBe(1);
    expect(result.graphicEventsAdded).toBeGreaterThanOrEqual(2);
    expect(result.staticEventsAdded).toBe(result.graphicEventsAdded);
    expect(laterGraphicText.every((text) => !text.includes('fused'))).toBe(true);
    expect(laterGraphicText.some((text) => text.includes('HOST — Please sign'))).toBe(true);
  });

  it('uses a deliberately contrasting deterministic pacing cycle', () => {
    expect(Array.from({ length: 8 }, (_, index) => remixedPacing(index))).toEqual([
      'frantic',
      'conversational',
      'staccato',
      'interrupted',
      'slow_burn',
      'frantic',
      'staccato',
      'near_silent',
    ]);
  });
});
