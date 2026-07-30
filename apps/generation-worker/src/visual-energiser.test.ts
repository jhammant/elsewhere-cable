import { describe, expect, it } from 'vitest';
import { segmentPackageSchema, type SegmentPackage } from '@elsewhere-cable/schemas';
import { editorialGraphicText, energiseVisualTimeline, remixedPacing } from './visual-energiser.js';

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
    expect(
      laterGraphicText.some((text) =>
        /(?:LIVE DEMO|OFFER STATUS|DEMO RESULT) \d+ · HOST \//u.test(text),
      ),
    ).toBe(true);
    expect(laterGraphicText.every((text) => !text.startsWith('HOST —'))).toBe(true);
  });

  it('can energise recovery visuals without adding audio static', () => {
    const result = energiseVisualTimeline(segment(), {
      pacing: 'frantic',
      repairGraphics: true,
      addStatic: false,
    });

    expect(result.cameraEventsAdded + result.graphicEventsAdded).toBeGreaterThan(0);
    expect(result.staticEventsAdded).toBe(0);
    expect(result.segment.events.some((event) => event.type === 'audio.static')).toBe(false);
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

  it('gives each programme format its own editorial graphic language', () => {
    const base = segment();
    const speech = base.events.find(
      (event): event is Extract<SegmentPackage['events'][number], { type: 'speech.play' }> =>
        event.type === 'speech.play',
    )!;
    const labels = (
      [
        ['advert', 'PRODUCT CLAIM'],
        ['emergency', 'INSTRUCTION'],
        ['ident', 'TRANSMISSION'],
        ['news', 'ON RECORD'],
        ['public_access', 'CASE FILE'],
        ['shopping', 'LIVE DEMO'],
        ['sitcom', 'IN THIS ROOM'],
      ] as const
    ).map(([format, label]) => {
      const candidate = {
        ...base,
        programme: { ...base.programme, format },
      };
      return [label, editorialGraphicText(candidate, speech, 0)] as const;
    });

    for (const [label, text] of labels) {
      expect(text).toMatch(new RegExp(`^${label} 01 · HOST /`, 'u'));
      expect(text).toContain('Please sign the small co-host agreement.');
    }

    expect(
      editorialGraphicText(
        base,
        {
          ...speech,
          characterName: 'The Extremely Elaborately Credentialled Demonstration Representative',
          subtitle:
            'This deliberately long statement keeps elaborating on the exact same product claim until the broadcast graphic has no responsible choice except to abbreviate it.',
        },
        29,
    ).length,
    ).toBeLessThanOrEqual(180);
  });

  it('preserves the contrasting opening and midpoint graphic sequence for every format', () => {
    const sequences = [
      ['advert', 'TITLE_CARD', 'LOWER_THIRD'],
      ['public_access', 'LOWER_THIRD', 'WARNING'],
      ['news', 'LOWER_THIRD', 'TITLE_CARD'],
      ['shopping', 'TITLE_CARD', 'LOWER_THIRD'],
      ['sitcom', 'TITLE_CARD', 'LOWER_THIRD'],
      ['emergency', 'WARNING', 'TITLE_CARD'],
      ['ident', 'TITLE_CARD', 'LOWER_THIRD'],
    ] as const;

    for (const [format, opening, midpoint] of sequences) {
      const base = segment();
      const candidate = {
        ...base,
        programme: { ...base.programme, format },
        events: base.events.map((event) =>
          event.type === 'graphic.show' && event.atMs <= 1_000
            ? { ...event, graphic: opening }
            : event,
        ),
      };
      const energised = energiseVisualTimeline(candidate, {
        addStatic: false,
      }).segment;

      expect(
        energised.events.find(
          (event) => event.type === 'graphic.show' && event.atMs === 550,
        ),
      ).toMatchObject({ graphic: opening });
      expect(
        energised.events.find(
          (event) => event.type === 'graphic.show' && event.atMs === 26_600,
        ),
      ).toMatchObject({ graphic: midpoint });
    }
  });
});
