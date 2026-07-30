import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { resolveProductionDesign, type VisualMedium } from './production-design.js';
import type { BroadcastSoundCue, ScheduledSoundCue } from './sound-design.js';

export type StoryVisualEffect =
  'cel_impact' | 'paper_burst' | 'pixel_blast' | 'prism_spill' | 'signal_rupture' | 'spectrum_arc';

export interface StoryVisualEffectDesign {
  effect: StoryVisualEffect;
  durationMs: number;
  maximumOpacity: number;
  maximumFlashesPerSecond: number;
}

const rainbowCues = new Set<BroadcastSoundCue>(['prism_chime', 'spectrum_sweep']);
const impactCues = new Set<BroadcastSoundCue>([
  'cel_impact',
  'paper_burst',
  'pixel_blast',
  'signal_rupture',
]);

const paperMedia = new Set<VisualMedium>([
  'archive_film',
  'collage_zine',
  'hand_drawn',
  'ink_monochrome',
  'paper_cutout',
  'shadow_theatre',
  'storybook_wash',
  'xerox_punk',
]);
const pixelMedia = new Set<VisualMedium>(['ascii_terminal', 'pixel_broadcast']);
const signalMedia = new Set<VisualMedium>([
  'blueprint_schematic',
  'neon_wireframe',
  'signal_corruption',
  'thermal_camera',
]);

export function resolveStoryVisualEffect(
  cue: BroadcastSoundCue,
  medium: VisualMedium,
  seed: number,
): StoryVisualEffectDesign | null {
  if (rainbowCues.has(cue)) {
    return {
      effect: seed % 2 === 0 ? 'spectrum_arc' : 'prism_spill',
      durationMs: 760 + (seed % 141),
      maximumOpacity: 0.58,
      maximumFlashesPerSecond: 1.25,
    };
  }
  if (!impactCues.has(cue)) {
    return null;
  }
  const effect: StoryVisualEffect = pixelMedia.has(medium)
    ? 'pixel_blast'
    : signalMedia.has(medium)
      ? 'signal_rupture'
      : paperMedia.has(medium)
        ? 'paper_burst'
        : 'cel_impact';
  return {
    effect,
    durationMs: 520 + (seed % 181),
    maximumOpacity: 0.64,
    maximumFlashesPerSecond: 2,
  };
}

export class BroadcastVisualEffects {
  private medium: VisualMedium = 'cel_shaded';
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly layer: HTMLElement) {}

  loadSegment(segment: SegmentPackage): void {
    this.medium = resolveProductionDesign(segment).visualMedium;
    this.reset();
  }

  play(cue: ScheduledSoundCue): void {
    const design = resolveStoryVisualEffect(cue.cue, this.medium, cue.seed);
    if (design === null) {
      return;
    }
    this.reset();
    this.layer.dataset.effect = design.effect;
    this.layer.style.setProperty('--effect-duration', `${design.durationMs}ms`);
    this.layer.style.setProperty('--effect-opacity', String(design.maximumOpacity));
    // Removing and restoring the class restarts the bounded CSS animation when
    // two legitimate story impacts occur in the same programme fragment.
    void this.layer.offsetWidth;
    this.layer.classList.add('is-active');
    this.clearTimer = setTimeout(() => this.reset(), design.durationMs + 80);
  }

  reset(): void {
    if (this.clearTimer !== null) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.layer.classList.remove('is-active');
    delete this.layer.dataset.effect;
  }
}
