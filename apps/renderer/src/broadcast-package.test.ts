import { describe, expect, it } from 'vitest';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { broadcastPackages, resolveBroadcastPackage } from './broadcast-package.js';

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
  ] as const;
  return {
    channel: {
      id: `channel_${700_000_000 + index}`,
      number: 700_000_000 + index,
      name: `Channel ${index}`,
      realityId: `REALITY-${index}`,
    },
    programme: {
      id: `programme_${index}`,
      title: `Programme ${index}`,
      format: formats[index % formats.length]!,
      premise: 'Two people disagree about one ordinary object.',
    },
    visualMedium: media[index % media.length]!,
  };
}

describe('channel-native broadcast packages', () => {
  it('keeps a recurring programme on a deterministic package', () => {
    const programme = segment(42);
    expect(resolveBroadcastPackage(programme)).toBe(resolveBroadcastPackage(programme));
  });

  it('uses every radically different screen silhouette across the catalogue', () => {
    const packages = new Set(
      Array.from({ length: 500 }, (_, index) => resolveBroadcastPackage(segment(index))),
    );
    expect(packages).toEqual(new Set(broadcastPackages));
  });

  it('does not let a programme title change its stable channel package', () => {
    const original = segment(91);
    const renamed = {
      ...original,
      programme: { ...original.programme, title: 'A Later Episode Title' },
    };
    expect(resolveBroadcastPackage(renamed)).toBe(resolveBroadcastPackage(original));
  });
});
