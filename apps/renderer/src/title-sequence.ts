import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { broadcastPackages, type BroadcastPackage } from './broadcast-package.js';

export const titleSequenceGrammars = [
  'signal_aperture',
  'civic_index',
  'cut_paper_stack',
  'orbit_registry',
  'vertical_marquee',
  'microfiche_window',
] as const;

export type TitleSequenceGrammar = (typeof titleSequenceGrammars)[number];

export interface TitleSequenceFrame {
  leftPercent: number;
  rightPercent: number;
  topPercent: number;
  heightPercent: number;
}

interface TitleSequenceDesign {
  typography: string;
  geometry: string;
  motion: string;
  texture: string;
}

const grammarByFormat: Record<
  SegmentPackage['programme']['format'],
  readonly TitleSequenceGrammar[]
> = {
  advert: ['vertical_marquee', 'cut_paper_stack', 'orbit_registry', 'signal_aperture'],
  public_access: ['civic_index', 'microfiche_window', 'cut_paper_stack', 'signal_aperture'],
  news: ['civic_index', 'microfiche_window', 'orbit_registry', 'vertical_marquee'],
  shopping: ['vertical_marquee', 'cut_paper_stack', 'signal_aperture', 'civic_index'],
  sitcom: ['cut_paper_stack', 'vertical_marquee', 'signal_aperture', 'orbit_registry'],
  emergency: ['signal_aperture', 'microfiche_window', 'civic_index', 'orbit_registry'],
  ident: titleSequenceGrammars,
};

const designs: Record<TitleSequenceGrammar, TitleSequenceDesign> = {
  signal_aperture: {
    typography: 'centred condensed uppercase',
    geometry: 'concentric offset portals',
    motion: 'iris open with counter-rotation',
    texture: 'broadcast phosphor',
  },
  civic_index: {
    typography: 'left aligned administrative grotesk',
    geometry: 'file tabs and docket rules',
    motion: 'sequential tab registration',
    texture: 'carbon copy paper',
  },
  cut_paper_stack: {
    typography: 'heavy hand-cut block',
    geometry: 'misregistered paper slabs',
    motion: 'stepped lateral assembly',
    texture: 'paper fibre',
  },
  orbit_registry: {
    typography: 'small caps with wide tracking',
    geometry: 'orbital paths and indexed bodies',
    motion: 'slow radial crossing',
    texture: 'night map',
  },
  vertical_marquee: {
    typography: 'oversized compressed vertical stack',
    geometry: 'sliding columns and hard bars',
    motion: 'opposed vertical wipes',
    texture: 'painted studio vinyl',
  },
  microfiche_window: {
    typography: 'monospaced archival caption',
    geometry: 'crosshairs and frame counters',
    motion: 'mechanical scan and focus pulse',
    texture: 'microfilm grain',
  },
};

export const titleSequenceFrames: Record<BroadcastPackage, TitleSequenceFrame> = {
  full_bleed: { leftPercent: 10, rightPercent: 10, topPercent: 14, heightPercent: 40 },
  boxed_43: { leftPercent: 24, rightPercent: 24, topPercent: 16, heightPercent: 36 },
  letterbox: { leftPercent: 8, rightPercent: 18, topPercent: 19, heightPercent: 32 },
  side_stack: { leftPercent: 6, rightPercent: 31, topPercent: 18, heightPercent: 36 },
  tabloid: { leftPercent: 5, rightPercent: 24, topPercent: 21, heightPercent: 40 },
};

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function resolveTitleSequenceGrammar(
  segment: Pick<SegmentPackage, 'channel' | 'programme' | 'visualMedium'>,
): TitleSequenceGrammar {
  const pool = grammarByFormat[segment.programme.format];
  const identity = `${segment.channel.id}:${segment.programme.id}:${segment.visualMedium}:title`;
  return pool[stableHash(identity) % pool.length] ?? 'signal_aperture';
}

export function titleSequenceFingerprint(grammar: TitleSequenceGrammar): string {
  const design = designs[grammar];
  return [design.typography, design.geometry, design.motion, design.texture].join('|');
}

export function titleSequenceFrame(broadcastPackage: BroadcastPackage): TitleSequenceFrame {
  return titleSequenceFrames[broadcastPackage];
}

export function titleSequenceSafeAreaIsValid(frame: TitleSequenceFrame): boolean {
  return (
    frame.leftPercent >= 3 &&
    frame.rightPercent >= 3 &&
    frame.topPercent >= 10 &&
    frame.heightPercent >= 24 &&
    frame.leftPercent + frame.rightPercent <= 60 &&
    frame.topPercent + frame.heightPercent <= 66
  );
}

export function assertTitleSequenceFramesComplete(): void {
  for (const broadcastPackage of broadcastPackages) {
    if (!titleSequenceSafeAreaIsValid(titleSequenceFrames[broadcastPackage])) {
      throw new Error(`Unsafe title-sequence frame for ${broadcastPackage}`);
    }
  }
}
