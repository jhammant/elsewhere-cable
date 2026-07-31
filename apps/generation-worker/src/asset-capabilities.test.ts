import { assetLibraryManifestSchema, type AssetLibraryManifest } from '@elsewhere-cable/schemas';
import { describe, expect, it } from 'vitest';
import { generationAssetCapabilities } from './asset-capabilities.js';

const manifest: AssetLibraryManifest = assetLibraryManifestSchema.parse({
  schemaVersion: 1,
  generatedAt: '2026-07-30T16:00:00.000Z',
  libraryId: 'test',
  appendOnly: true,
  assets: [
    {
      id: 'asset_test_background',
      kind: 'model_2d',
      role: 'fictional_background_bank',
      version: 1,
      status: 'ready',
      uri: 'procedure://renderer/backgrounds/test',
      tags: ['coral-observatory', 'orbital-kitchen'],
      programmeIds: [],
      compatibleVisualMedia: ['paper_cutout'],
      provenance: {
        source: 'procedural_original',
        createdAt: '2026-07-30T16:00:00.000Z',
        generator: 'test',
        rights: 'original-project-code',
        containsFictionalPeople: false,
        containsRealPeople: false,
      },
    },
    {
      id: 'asset_reserved_background',
      kind: 'image_2d',
      role: 'background_plate',
      version: 1,
      status: 'ready',
      uri: '/assets/private-test.png',
      mimeType: 'image/png',
      sha256: 'a'.repeat(64),
      bytes: 10,
      tags: ['reserved-freezer'],
      programmeIds: ['reserved_programme'],
      compatibleVisualMedia: ['paper_cutout'],
      provenance: {
        source: 'generated_original',
        createdAt: '2026-07-30T16:00:00.000Z',
        generator: 'test',
        rights: 'original-project-generation',
        containsFictionalPeople: false,
        containsRealPeople: false,
      },
    },
    {
      id: 'asset_test_visual_effect',
      kind: 'shader_style',
      role: 'story_effect_bank',
      version: 1,
      status: 'ready',
      uri: 'procedure://renderer/effects/test',
      tags: ['spectrum-arc', 'paper-burst'],
      programmeIds: [],
      compatibleVisualMedia: [],
      provenance: {
        source: 'procedural_original',
        createdAt: '2026-07-30T16:00:00.000Z',
        generator: 'test',
        rights: 'original-project-code',
        containsFictionalPeople: false,
        containsRealPeople: false,
      },
    },
    {
      id: 'asset_test_sound_effect',
      kind: 'sound_effect',
      role: 'story_effect_bank',
      version: 1,
      status: 'ready',
      uri: 'procedure://audio/sfx/test',
      tags: ['spectrum-sweep', 'paper-impact'],
      programmeIds: [],
      compatibleVisualMedia: [],
      provenance: {
        source: 'procedural_original',
        createdAt: '2026-07-30T16:00:00.000Z',
        generator: 'test',
        rights: 'original-project-code',
        containsFictionalPeople: false,
        containsRealPeople: false,
      },
    },
  ],
});

describe('generationAssetCapabilities', () => {
  it('exposes only compatible reusable capabilities without paths or reserved art', () => {
    const brief = generationAssetCapabilities(manifest, 'paper_cutout');

    expect(brief).toContain('coral observatory');
    expect(brief).toContain('orbital kitchen');
    expect(brief).not.toContain('reserved freezer');
    expect(brief).not.toContain('/assets/');
    expect(brief).toContain('never add an explosion, rainbow');
    expect(brief).toContain('write every substantive spoken line afresh');
    expect(brief).toMatch(/visual effects: paper burst, spectrum arc\./u);
    expect(brief).toMatch(/sound effects: paper impact, spectrum sweep\./u);
    expect(brief).not.toMatch(/visual effects:[^\n]*spectrum sweep/u);
    expect(brief).not.toMatch(/sound effects:[^\n]*spectrum arc/u);
  });

  it('does not advertise an incompatible renderer asset', () => {
    const brief = generationAssetCapabilities(manifest, 'cel_shaded');
    expect(brief).not.toContain('coral observatory');
    expect(brief).toContain('spectrum arc');
  });
});
