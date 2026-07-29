import type { VisualMedium } from './production-design.js';

export const flatStyleGrammars = {
  paper_cutout: {
    silhouette: 'hinged-paper-puppet',
    backdrop: 'layered-construction-stage',
    motion: 'limited-joint-animation',
    texture: 'paper-fibre',
  },
  collage_zine: {
    silhouette: 'torn-photo-assemblage',
    backdrop: 'misregistered-editorial-collage',
    motion: 'jump-cut-jitter',
    texture: 'newsprint-and-glue',
  },
  ink_monochrome: {
    silhouette: 'heavy-brush-caricature',
    backdrop: 'crosshatched-ink-panel',
    motion: 'held-drawing-boil',
    texture: 'dry-brush-lines',
  },
  corporate_vector: {
    silhouette: 'infographic-avatar',
    backdrop: 'clean-diagram-space',
    motion: 'presentation-easing',
    texture: 'none',
  },
  hand_drawn: {
    silhouette: 'loose-pencil-character',
    backdrop: 'wobbling-notebook-world',
    motion: 'line-boil',
    texture: 'pencil-and-paper',
  },
  pixel_broadcast: {
    silhouette: 'eight-bit-sprite',
    backdrop: 'tile-map-studio',
    motion: 'stepped-sprite-animation',
    texture: 'hard-pixels',
  },
  archive_film: {
    silhouette: 'silent-era-cutout',
    backdrop: 'sepia-proscenium',
    motion: 'hand-cranked-film',
    texture: 'scratches-and-dust',
  },
  signal_corruption: {
    silhouette: 'fragmented-rgb-figure',
    backdrop: 'broken-signal-field',
    motion: 'datamosh-displacement',
    texture: 'scan-errors',
  },
  shadow_theatre: {
    silhouette: 'rod-puppet-shadow',
    backdrop: 'backlit-parchment-stage',
    motion: 'pendulum-puppetry',
    texture: 'paper-grain',
  },
  thermal_camera: {
    silhouette: 'heat-signature-body',
    backdrop: 'instrument-surveillance',
    motion: 'tracked-thermal-drift',
    texture: 'sensor-noise',
  },
  ascii_terminal: {
    silhouette: 'monospace-glyph-actor',
    backdrop: 'phosphor-command-console',
    motion: 'cursor-stepped-performance',
    texture: 'crt-character-bloom',
  },
  blueprint_schematic: {
    silhouette: 'dimensioned-exploded-figure',
    backdrop: 'architectural-drafting-sheet',
    motion: 'annotated-mechanical-articulation',
    texture: 'cyanotype-grid',
  },
  stained_glass: {
    silhouette: 'leaded-faceted-character',
    backdrop: 'luminous-rose-window-world',
    motion: 'refracted-panel-shift',
    texture: 'cathedral-glass-grain',
  },
  xerox_punk: {
    silhouette: 'photocopied-ransom-cutout',
    backdrop: 'overprinted-flyposter-wall',
    motion: 'toner-jump-duplication',
    texture: 'high-contrast-copy-noise',
  },
  storybook_wash: {
    silhouette: 'painted-ink-story-figure',
    backdrop: 'layered-watercolour-landscape',
    motion: 'gentle-page-parallax',
    texture: 'pigment-bloom-paper',
  },
  isometric_manual: {
    silhouette: 'exploded-instruction-avatar',
    backdrop: 'axonometric-assembly-sheet',
    motion: 'numbered-diagram-steps',
    texture: 'registration-mark-print',
  },
} as const;

export type FlatVisualMedium = keyof typeof flatStyleGrammars;

export const flatVisualMedia = new Set<VisualMedium>(
  Object.keys(flatStyleGrammars) as FlatVisualMedium[],
);

export function isFlatVisualMedium(medium: VisualMedium): medium is FlatVisualMedium {
  return flatVisualMedia.has(medium);
}

export function flatStyleFingerprint(medium: FlatVisualMedium): string {
  const grammar = flatStyleGrammars[medium];
  return [grammar.silhouette, grammar.backdrop, grammar.motion, grammar.texture].join('|');
}
