import { describe, expect, it } from 'vitest';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import {
  premisePropKind,
  resolve2DCharacterDesign,
  usesTwoDimensionalRenderer,
} from './scene-2d.js';
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
    expect(usesTwoDimensionalRenderer(segment('ascii_terminal'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('blueprint_schematic'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('stained_glass'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('xerox_punk'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('storybook_wash'))).toBe(true);
    expect(usesTwoDimensionalRenderer(segment('isometric_manual'))).toBe(true);
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

describe('2D cast construction', () => {
  it('gives every explicit cast family its own structural silhouette', () => {
    const designs = [
      resolve2DCharacterDesign('humanoid', 101, 0),
      resolve2DCharacterDesign('geometric_aliens', 202, 0),
      resolve2DCharacterDesign('talking_objects', 303, 0),
      resolve2DCharacterDesign('celestial', 404, 0),
      resolve2DCharacterDesign('paper_puppets', 505, 0),
    ];

    expect(new Set(designs.map((design) => design.silhouette)).size).toBe(designs.length);
    expect(new Set(designs.map((design) => design.fingerprint)).size).toBe(designs.length);
  });

  it('turns a mixed cast into a deterministic variety of structural families', () => {
    const firstPass = Array.from({ length: 5 }, (_, index) =>
      resolve2DCharacterDesign('mixed', 73, index),
    );
    const secondPass = Array.from({ length: 5 }, (_, index) =>
      resolve2DCharacterDesign('mixed', 73, index),
    );

    expect(new Set(firstPass.map((design) => design.archetype)).size).toBe(5);
    expect(firstPass).toEqual(secondPass);
  });

  it('varies two actors inside the same cast family without changing the family', () => {
    const first = resolve2DCharacterDesign('talking_objects', 601, 0);
    const second = resolve2DCharacterDesign('talking_objects', 947, 1);

    expect(first.archetype).toBe('talking_objects');
    expect(second.archetype).toBe('talking_objects');
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });
});

describe('2D premise props', () => {
  it('matches programme nouns to visibly distinct props', () => {
    const premises = [
      ['A refrigerator wants an introduction.', 'fridge'],
      ['The umbrella refuses to close.', 'umbrella'],
      ['A fish files a complaint.', 'fish'],
      ['The letter requests a larger margin.', 'letter'],
      ['A concert ticket demands its own seat.', 'letter'],
      ['The bin wants a formal collection.', 'bin'],
      ['The staircase skips step four.', 'staircase'],
      ['A telephone calls its own advert.', 'phone'],
      ['An empty chair demands a speaking turn.', 'chair'],
      ['The Escape key has left the keyboard.', 'key'],
      ['A spotlight requests a supervisor.', 'lamp'],
    ] as const;

    for (const [premise, expected] of premises) {
      expect(premisePropKind(premise)).toBe(expected);
    }
  });

  it('prefers the concrete prop over broader setting words', () => {
    expect(premisePropKind('In a family kitchen, the refrigerator refuses service.')).toBe(
      'fridge',
    );
    expect(premisePropKind('During a weather report, one umbrella requests credit.')).toBe(
      'umbrella',
    );
  });
});
