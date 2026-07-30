import { describe, expect, it } from 'vitest';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import {
  directedCamera,
  directionProfiles,
  directionTreatment,
  resolveDirectionProfile,
} from './direction-profile.js';

function segment(
  index: number,
): Pick<SegmentPackage, 'channel' | 'programme' | 'visualMedium' | 'pacing'> {
  const formats: SegmentPackage['programme']['format'][] = [
    'advert',
    'public_access',
    'news',
    'shopping',
    'sitcom',
    'emergency',
    'ident',
  ];
  const media: NonNullable<SegmentPackage['visualMedium']>[] = [
    'cel_shaded',
    'paper_cutout',
    'miniature_diorama',
    'collage_zine',
    'archive_film',
    'ascii_terminal',
    'storybook_wash',
  ];
  const pacing: NonNullable<SegmentPackage['pacing']>[] = [
    'frantic',
    'staccato',
    'conversational',
    'slow_burn',
    'interrupted',
    'near_silent',
  ];
  return {
    channel: {
      id: `channel_${index}`,
      number: 50_000_000 + index * 104_729,
      name: `Channel ${index}`,
      realityId: `REALITY_${index}`,
    },
    programme: {
      id: `programme_${index}`,
      title: `Programme ${index}`,
      format: formats[index % formats.length]!,
      premise: 'Two incompatible ordinary wants become visibly harder to reconcile.',
    },
    visualMedium: media[index % media.length],
    pacing: pacing[index % pacing.length],
  };
}

describe('programme direction profiles', () => {
  it('keeps recurring programme direction deterministic', () => {
    const source = segment(17);
    expect(resolveDirectionProfile(source)).toBe(resolveDirectionProfile(source));
  });

  it('uses every direction language across a large channel ecosystem', () => {
    const profiles = Array.from({ length: 4_000 }, (_, index) =>
      resolveDirectionProfile(segment(index)),
    );
    expect(new Set(profiles)).toEqual(new Set(directionProfiles));
  });

  it('turns reaction coverage into reverse shots and tableaus into held wides', () => {
    expect(directedCamera('reaction_cuts', 'CAMERA_HOST')).toBe('CAMERA_GUEST');
    expect(directedCamera('reaction_cuts', 'CAMERA_GUEST')).toBe('CAMERA_HOST');
    expect(directedCamera('locked_tableau', 'CAMERA_HOST')).toBe('CAMERA_WIDE');
    expect(directedCamera('surveillance', 'CAMERA_GUEST')).toBe('CAMERA_WIDE');
    expect(directedCamera('tiny_stage', 'CAMERA_HOST')).toBe('CAMERA_WIDE');
  });

  it('gives treatments genuinely different framing fingerprints', () => {
    const fingerprints = directionProfiles.map((profile) => {
      const treatment = directionTreatment(profile, 'CAMERA_HOST', 3.75, 0.418);
      return [treatment.zoom, treatment.roll, treatment.drift]
        .map((value) => value.toFixed(4))
        .join(':');
    });
    expect(new Set(fingerprints).size).toBe(directionProfiles.length);
  });

  it('keeps all treatments within a safe broadcast transform', () => {
    for (const profile of directionProfiles) {
      for (const camera of ['CAMERA_WIDE', 'CAMERA_HOST', 'CAMERA_GUEST'] as const) {
        for (let frame = 0; frame < 250; frame += 1) {
          const treatment = directionTreatment(profile, camera, frame / 25, 0.731);
          expect(treatment.zoom).toBeGreaterThanOrEqual(0.75);
          expect(treatment.zoom).toBeLessThanOrEqual(1.35);
          expect(Math.abs(treatment.roll)).toBeLessThanOrEqual(0.08);
          expect(Math.abs(treatment.drift)).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });
});
