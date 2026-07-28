import type { SegmentPackage } from '@elsewhere-cable/schemas';

export type VisualMedium = NonNullable<SegmentPackage['visualMedium']>;
export type CastArchetype = NonNullable<SegmentPackage['castArchetype']>;

export interface ProductionDesign {
  visualMedium: VisualMedium;
  castArchetype: CastArchetype;
}

export function resolveProductionDesign(segment: SegmentPackage): ProductionDesign {
  const visualMedium =
    segment.visualMedium ??
    (segment.channel.number === 113
      ? 'paper_cutout'
      : segment.channel.number === 802
        ? 'signal_corruption'
        : segment.programme.id.includes('bureau')
          ? 'archive_film'
          : segment.programme.format === 'news'
            ? 'cel_shaded'
            : segment.programme.format === 'shopping'
              ? 'neon_wireframe'
              : segment.programme.format === 'sitcom'
                ? 'pixel_broadcast'
                : segment.programme.format === 'public_access'
                  ? 'public_access_vhs'
                  : segment.programme.format === 'emergency'
                    ? 'signal_corruption'
                    : 'stop_motion');

  const castArchetype =
    segment.castArchetype ??
    (segment.channel.number === 113
      ? 'celestial'
      : segment.channel.number === 802
        ? 'geometric_aliens'
        : segment.programme.id.includes('bureau')
          ? 'paper_puppets'
          : segment.programme.format === 'shopping'
            ? 'geometric_aliens'
            : segment.programme.format === 'sitcom'
              ? 'talking_objects'
              : segment.programme.format === 'news'
                ? 'mixed'
                : 'humanoid');

  return { visualMedium, castArchetype };
}
