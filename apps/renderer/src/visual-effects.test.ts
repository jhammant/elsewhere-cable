import { describe, expect, it } from 'vitest';
import { resolveStoryVisualEffect } from './visual-effects.js';

describe('resolveStoryVisualEffect', () => {
  it('uses the current programme medium to choose a materially different impact grammar', () => {
    expect(resolveStoryVisualEffect('paper_burst', 'paper_cutout', 4)?.effect).toBe('paper_burst');
    expect(resolveStoryVisualEffect('cel_impact', 'cel_shaded', 4)?.effect).toBe('cel_impact');
    expect(resolveStoryVisualEffect('pixel_blast', 'pixel_broadcast', 4)?.effect).toBe(
      'pixel_blast',
    );
    expect(resolveStoryVisualEffect('signal_rupture', 'signal_corruption', 4)?.effect).toBe(
      'signal_rupture',
    );
  });

  it('alternates two spectrum grammars without unbounded flashing', () => {
    const even = resolveStoryVisualEffect('prism_chime', 'storybook_wash', 8);
    const odd = resolveStoryVisualEffect('spectrum_sweep', 'stained_glass', 9);

    expect(even?.effect).toBe('spectrum_arc');
    expect(odd?.effect).toBe('prism_spill');
    for (const design of [even, odd]) {
      expect(design?.durationMs).toBeGreaterThanOrEqual(400);
      expect(design?.durationMs).toBeLessThanOrEqual(950);
      expect(design?.maximumOpacity).toBeLessThanOrEqual(0.65);
      expect(design?.maximumFlashesPerSecond).toBeLessThanOrEqual(3);
    }
  });

  it('does not turn ordinary prop sounds into screen-wide spectacle', () => {
    expect(resolveStoryVisualEffect('bell', 'paper_cutout', 4)).toBeNull();
    expect(resolveStoryVisualEffect('bureaucratic_stamp', 'collage_zine', 5)).toBeNull();
  });
});
