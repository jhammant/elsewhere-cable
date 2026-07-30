import type { SegmentPackage } from '@elsewhere-cable/schemas';

export const directionProfiles = [
  'formal_symmetry',
  'locked_tableau',
  'crash_zoom',
  'reaction_cuts',
  'dutch_angle',
  'surveillance',
  'product_macro',
  'rostrum_pan',
  'tiny_stage',
  'handheld',
] as const;

export type DirectionProfile = (typeof directionProfiles)[number];
export type DirectedCamera = 'CAMERA_WIDE' | 'CAMERA_HOST' | 'CAMERA_GUEST';

const pacingPools: Record<NonNullable<SegmentPackage['pacing']>, readonly DirectionProfile[]> = {
  frantic: ['crash_zoom', 'handheld', 'dutch_angle', 'reaction_cuts'],
  staccato: ['reaction_cuts', 'crash_zoom', 'formal_symmetry', 'dutch_angle'],
  conversational: ['formal_symmetry', 'reaction_cuts', 'rostrum_pan', 'locked_tableau'],
  slow_burn: ['locked_tableau', 'tiny_stage', 'formal_symmetry', 'rostrum_pan'],
  interrupted: ['surveillance', 'dutch_angle', 'handheld', 'locked_tableau'],
  near_silent: ['tiny_stage', 'surveillance', 'locked_tableau', 'rostrum_pan'],
};

const formatAccents: Record<SegmentPackage['programme']['format'], readonly DirectionProfile[]> = {
  advert: ['product_macro', 'crash_zoom', 'handheld'],
  public_access: ['locked_tableau', 'surveillance', 'reaction_cuts'],
  news: ['formal_symmetry', 'dutch_angle', 'surveillance'],
  shopping: ['product_macro', 'crash_zoom', 'reaction_cuts'],
  sitcom: ['reaction_cuts', 'locked_tableau', 'handheld'],
  emergency: ['surveillance', 'dutch_angle', 'locked_tableau'],
  ident: ['rostrum_pan', 'tiny_stage', 'formal_symmetry'],
};

const flatMedia = new Set<NonNullable<SegmentPackage['visualMedium']>>([
  'paper_cutout',
  'collage_zine',
  'ink_monochrome',
  'corporate_vector',
  'hand_drawn',
  'pixel_broadcast',
  'archive_film',
  'signal_corruption',
  'shadow_theatre',
  'thermal_camera',
  'ascii_terminal',
  'blueprint_schematic',
  'stained_glass',
  'xerox_punk',
  'storybook_wash',
  'isometric_manual',
]);

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * Direction is independent from the renderer medium and broadcast package.
 * Recurring programmes keep a recognisable editing language while the broader
 * network can move between radically different rhythms.
 */
export function resolveDirectionProfile(
  segment: Pick<SegmentPackage, 'channel' | 'programme' | 'visualMedium' | 'pacing'>,
): DirectionProfile {
  const pacing = segment.pacing ?? 'conversational';
  const pool = [
    ...formatAccents[segment.programme.format],
    ...pacingPools[pacing],
    ...(segment.visualMedium !== undefined && flatMedia.has(segment.visualMedium)
      ? (['rostrum_pan'] as const)
      : []),
  ];
  const identity = [
    segment.channel.id,
    segment.programme.id,
    segment.visualMedium ?? 'unspecified',
    pacing,
    'direction',
  ].join(':');
  return pool[stableHash(identity) % pool.length] ?? 'formal_symmetry';
}

export function directedCamera(
  profile: DirectionProfile,
  requested: DirectedCamera,
): DirectedCamera {
  if (profile === 'locked_tableau' || profile === 'surveillance' || profile === 'tiny_stage') {
    return 'CAMERA_WIDE';
  }
  if (profile === 'reaction_cuts') {
    if (requested === 'CAMERA_HOST') {
      return 'CAMERA_GUEST';
    }
    if (requested === 'CAMERA_GUEST') {
      return 'CAMERA_HOST';
    }
  }
  return requested;
}

export interface DirectionTreatment {
  zoom: number;
  roll: number;
  drift: number;
}

export function directionTreatment(
  profile: DirectionProfile,
  camera: DirectedCamera,
  elapsedSeconds: number,
  seed = 0,
): DirectionTreatment {
  const elapsed = Math.max(0, elapsedSeconds);
  const close = camera !== 'CAMERA_WIDE';
  switch (profile) {
    case 'crash_zoom':
      return {
        zoom: close ? 1.32 : 1.08,
        roll: 0,
        drift: Math.sin(elapsed * 3.7 + seed * 9) * 0.28,
      };
    case 'dutch_angle':
      return {
        zoom: close ? 1.12 : 1.03,
        roll: (camera === 'CAMERA_HOST' ? -1 : 1) * (close ? 0.072 : 0.035),
        drift: Math.sin(elapsed * 0.7 + seed * 5) * 0.18,
      };
    case 'surveillance':
      return { zoom: 0.86, roll: 0, drift: 0 };
    case 'product_macro':
      return {
        zoom: close ? 1.26 : 1.04,
        roll: 0,
        drift: Math.sin(elapsed * 0.55 + seed * 7) * 0.08,
      };
    case 'rostrum_pan':
      return {
        zoom: close ? 1.16 : 1.02,
        roll: Math.sin(seed * 11) * 0.012,
        drift: Math.sin(elapsed * 0.28 + seed * 3) * 0.14,
      };
    case 'tiny_stage':
      return { zoom: 0.78, roll: 0, drift: 0 };
    case 'handheld':
      return {
        zoom: close ? 1.1 : 1.02,
        roll: Math.sin(elapsed * 0.93 + seed * 7) * 0.018,
        drift:
          Math.sin(elapsed * 1.7 + seed * 13) * 0.32 + Math.sin(elapsed * 3.1 + seed * 5) * 0.12,
      };
    case 'reaction_cuts':
      return { zoom: close ? 1.18 : 1.01, roll: 0, drift: 0 };
    case 'locked_tableau':
      return { zoom: 1, roll: 0, drift: 0 };
    case 'formal_symmetry':
      return { zoom: close ? 1.08 : 1, roll: 0, drift: 0 };
  }
}
