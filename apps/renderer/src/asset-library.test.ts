import { describe, expect, it } from 'vitest';
import {
  assetLibraryManifestSchema,
  type AssetLibraryManifest,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';
import {
  matchingCharacterAsset,
  matchingPropAsset,
  visualAssetCollection,
} from './asset-library.js';

function segment(programmeId: string, premise = 'A doorbell files a complaint.'): SegmentPackage {
  return {
    schemaVersion: 1,
    segmentId: 'seg_asset_test',
    channel: { id: 'channel_asset', number: 98_100, name: 'Asset Test', realityId: 'ASSET-1' },
    programme: {
      id: programmeId,
      title: 'Asset Test',
      format: 'public_access',
      premise,
    },
    durationMs: 5_000,
    visualStyle: 'asset_test',
    visualMedium: 'collage_zine',
    castArchetype: 'humanoid',
    tone: ['dry'],
    events: [{ atMs: 0, type: 'camera.cut', camera: 'CAMERA_WIDE' }],
    continuityUpdates: [],
    suggestedExit: { earliestMs: 4_000, preferredMs: 5_000, transition: 'HARD_CUT' },
    production: {
      generatedAt: '2026-07-30T15:00:00.000Z',
      generator: 'test',
      model: 'test',
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: true,
    },
  };
}

const provenance = {
  source: 'generated_original' as const,
  createdAt: '2026-07-30T15:00:00.000Z',
  generator: 'test',
  rights: 'original-test',
  containsFictionalPeople: false,
  containsRealPeople: false as const,
};

const manifest: AssetLibraryManifest = assetLibraryManifestSchema.parse({
  schemaVersion: 1,
  generatedAt: '2026-07-30T15:00:00.000Z',
  libraryId: 'test',
  appendOnly: true,
  assets: [
    {
      id: 'asset_bg_test',
      kind: 'image_2d',
      role: 'background_plate',
      version: 1,
      status: 'ready',
      uri: '/assets/test/background.png',
      collectionId: 'test-collection',
      sha256: 'a'.repeat(64),
      bytes: 10,
      tags: ['studio'],
      programmeIds: ['photo_programme'],
      compatibleVisualMedia: ['collage_zine'],
      provenance,
    },
    {
      id: 'asset_actor_test',
      kind: 'image_2d',
      role: 'character_cutout',
      version: 1,
      status: 'ready',
      uri: '/assets/test/actor.png',
      collectionId: 'test-collection',
      sha256: 'b'.repeat(64),
      bytes: 10,
      tags: ['fictional-person', 'mara'],
      programmeIds: ['photo_programme'],
      compatibleVisualMedia: ['collage_zine'],
      provenance: { ...provenance, containsFictionalPeople: true },
    },
    {
      id: 'asset_bg_generic_newsroom',
      kind: 'image_2d',
      role: 'background_plate',
      version: 1,
      status: 'ready',
      uri: '/assets/test/generic-newsroom.png',
      collectionId: 'generic-newsroom',
      sha256: 'd'.repeat(64),
      bytes: 10,
      tags: ['newsroom', 'railway', 'signal-box'],
      programmeIds: [],
      compatibleVisualMedia: ['collage_zine'],
      provenance,
    },
    {
      id: 'asset_prop_test_doorbell',
      kind: 'image_2d',
      role: 'prop_cutout',
      version: 1,
      status: 'ready',
      uri: '/assets/test/doorbell.png',
      sha256: 'c'.repeat(64),
      bytes: 10,
      tags: ['doorbell'],
      programmeIds: [],
      compatibleVisualMedia: ['collage_zine'],
      provenance,
    },
  ],
});

describe('asset library selection', () => {
  it('selects a complete programme-bound visual collection', () => {
    const collection = visualAssetCollection(manifest, segment('photo_programme'));
    expect(collection?.id).toBe('test-collection');
    expect(collection?.characters.map((entry) => entry.id)).toEqual(['asset_actor_test']);
    expect(matchingCharacterAsset(collection, 'Mara Vale', 0)?.id).toBe('asset_actor_test');
  });

  it('uses a reusable image background without leaking programme-bound characters', () => {
    const collection = visualAssetCollection(
      manifest,
      segment('another_programme', 'A railway newsroom debates a signal.'),
    );
    expect(collection?.id).toBe('generic-newsroom');
    expect(collection?.characters).toEqual([]);
  });

  it('matches reusable props from concrete premise nouns', () => {
    expect(matchingPropAsset(manifest, segment('any_programme'))?.id).toBe(
      'asset_prop_test_doorbell',
    );
    expect(
      matchingPropAsset(manifest, segment('any_programme', 'A chair requests a receipt.')),
    ).toBeNull();
  });

  it('does not match a reusable prop only because its generic category appears', () => {
    expect(
      matchingPropAsset(
        manifest,
        segment('any_programme', 'A new product requests an itemised receipt.'),
      ),
    ).toBeNull();
  });
});
