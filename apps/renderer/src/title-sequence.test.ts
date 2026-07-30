import { describe, expect, it } from 'vitest';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { broadcastPackages } from './broadcast-package.js';
import {
  assertTitleSequenceFramesComplete,
  resolveTitleSequenceGrammar,
  titleSequenceFingerprint,
  titleSequenceFrame,
  titleSequenceGrammars,
  titleSequenceSafeAreaIsValid,
} from './title-sequence.js';

function segment(index: number): Pick<SegmentPackage, 'channel' | 'programme' | 'visualMedium'> {
  const formats = [
    'advert',
    'public_access',
    'news',
    'shopping',
    'sitcom',
    'emergency',
    'ident',
  ] as const;
  const media = [
    'cel_shaded',
    'paper_cutout',
    'pixel_broadcast',
    'archive_film',
    'neon_wireframe',
    'collage_zine',
    'shadow_theatre',
  ] as const;
  return {
    channel: {
      id: `channel_${9_000_000_000 + index}`,
      number: 9_000_000_000 + index,
      name: `Title Channel ${index}`,
      realityId: `TITLE-${index}`,
    },
    programme: {
      id: `title_programme_${index}`,
      title: `Title Programme ${index}`,
      format: formats[index % formats.length]!,
      premise: 'A title sequence attempts to introduce one impossible programme.',
    },
    visualMedium: media[index % media.length]!,
  };
}

describe('title-sequence graphics package', () => {
  it('keeps recurring programmes on a deterministic title grammar', () => {
    const programme = segment(81);
    expect(resolveTitleSequenceGrammar(programme)).toBe(resolveTitleSequenceGrammar(programme));
  });

  it('uses every structurally distinct title grammar across the channel catalogue', () => {
    const observed = new Set(
      Array.from({ length: 800 }, (_, index) => resolveTitleSequenceGrammar(segment(index))),
    );
    expect(observed).toEqual(new Set(titleSequenceGrammars));
    expect(
      new Set(titleSequenceGrammars.map((grammar) => titleSequenceFingerprint(grammar))).size,
    ).toBe(titleSequenceGrammars.length);
  });

  it('does not change a recurring grammar when only an episode title changes', () => {
    const original = segment(129);
    const renamed = {
      ...original,
      programme: { ...original.programme, title: 'A Different Episode Title' },
    };
    expect(resolveTitleSequenceGrammar(renamed)).toBe(resolveTitleSequenceGrammar(original));
  });

  it('keeps every title frame inside the programme and subtitle-safe plane', () => {
    expect(() => assertTitleSequenceFramesComplete()).not.toThrow();
    for (const broadcastPackage of broadcastPackages) {
      const frame = titleSequenceFrame(broadcastPackage);
      expect(titleSequenceSafeAreaIsValid(frame), broadcastPackage).toBe(true);
      expect(frame.leftPercent + frame.rightPercent).toBeLessThanOrEqual(60);
      expect(frame.topPercent + frame.heightPercent).toBeLessThanOrEqual(66);
    }
  });
});
