import type { SegmentPackage } from '@elsewhere-cable/schemas';

export const broadcastPackages = [
  'full_bleed',
  'boxed_43',
  'letterbox',
  'side_stack',
  'tabloid',
] as const;

export type BroadcastPackage = (typeof broadcastPackages)[number];

const packagesByFormat: Record<SegmentPackage['programme']['format'], readonly BroadcastPackage[]> =
  {
    advert: ['full_bleed', 'tabloid', 'side_stack', 'letterbox'],
    public_access: ['boxed_43', 'side_stack', 'tabloid', 'full_bleed'],
    news: ['tabloid', 'side_stack', 'letterbox', 'full_bleed'],
    shopping: ['side_stack', 'tabloid', 'full_bleed', 'boxed_43'],
    sitcom: ['boxed_43', 'letterbox', 'full_bleed', 'tabloid'],
    emergency: ['letterbox', 'tabloid', 'boxed_43', 'full_bleed'],
    ident: ['full_bleed', 'letterbox', 'boxed_43', 'tabloid'],
  };

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * A recurring programme keeps its own recognisable package, while unrelated
 * programmes can have completely different frame silhouettes even when they
 * happen to use the same renderer medium.
 */
export function resolveBroadcastPackage(
  segment: Pick<SegmentPackage, 'channel' | 'programme' | 'visualMedium'>,
): BroadcastPackage {
  const pool = packagesByFormat[segment.programme.format];
  const identity = `${segment.channel.id}:${segment.programme.id}:${segment.visualMedium}`;
  return pool[stableHash(identity) % pool.length] ?? 'full_bleed';
}
