import { describe, expect, it } from 'vitest';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { usesTwoDimensionalRenderer } from './scene-2d.js';
import { flatStyleFingerprint, flatStyleGrammars, type FlatVisualMedium } from './style-grammar.js';

function segment(visualMedium: SegmentPackage['visualMedium']): SegmentPackage {
  return {
    schemaVersion: 1,
    segmentId: 'seg_renderer_selection',
    channel: { id: 'channel_test', number: 10, name: 'Test', realityId: 'TEST' },
    programme: {
      id: 'renderer_selection',
      title: 'Renderer Selection',
      format: 'public_access',
      premise: 'A renderer selects the correct production plane.',
    },
    durationMs: 5_000,
    visualStyle: 'test',
    visualMedium,
    castArchetype: 'mixed',
    tone: ['test'],
    events: [{ atMs: 0, type: 'camera.cut', camera: 'CAMERA_WIDE' }],
    continuityUpdates: [],
    suggestedExit: { earliestMs: 4_000, preferredMs: 5_000, transition: 'HARD_CUT' },
    production: {
      generatedAt: '2026-07-28T10:00:00.000Z',
      generator: 'test',
      model: 'test',
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: true,
    },
  };
}

describe('hybrid renderer selection', () => {
  it('routes flat graphic media to the real 2D canvas', () => {
    expect(usesTwoDimensionalRenderer(segment('paper_cutout'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('collage_zine'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('ink_monochrome'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('corporate_vector'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('hand_drawn'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('pixel_broadcast'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('archive_film'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('signal_corruption'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('shadow_theatre'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('thermal_camera'))).toBe(true);
  });

  it('keeps volumetric media in Three.js', () => {
    expect(usesTwoDimensionalRenderer(segment('cel_shaded'))).toBe(false);
    expect(usesTwoDimensionalRenderer(segment('miniature_diorama'))).toBe(false);
    expect(usesTwoDimensionalRenderer(segment('claymation'))).toBe(false);
  });

  it('assigns every flat channel a different production grammar', () => {
    const media = Object.keys(flatStyleGrammars) as FlatVisualMedium[];
    const fingerprints = media.map((medium) => flatStyleFingerprint(medium));

    expect(new Set(fingerprints).size).toBe(media.length);
  });
});
