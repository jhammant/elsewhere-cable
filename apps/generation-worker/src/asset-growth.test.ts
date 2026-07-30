import { describe, expect, it } from 'vitest';
import {
  assetLibraryManifestSchema,
  optimisationBriefSchema,
  type AssetLibraryManifest,
} from '@elsewhere-cable/schemas';
import { nextAssetGrowthRequest } from './asset-growth.js';

const manifest: AssetLibraryManifest = assetLibraryManifestSchema.parse({
  schemaVersion: 1,
  generatedAt: '2026-07-30T15:00:00.000Z',
  libraryId: 'asset-growth-test',
  appendOnly: true,
  assets: [
    {
      id: 'asset_test_image',
      kind: 'image_2d',
      role: 'background_plate',
      version: 1,
      status: 'ready',
      uri: 'procedure://test/image',
      tags: [],
      programmeIds: [],
      compatibleVisualMedia: [],
      provenance: {
        source: 'procedural_original',
        createdAt: '2026-07-30T15:00:00.000Z',
        generator: 'test',
        rights: 'test',
        containsFictionalPeople: false,
        containsRealPeople: false,
      },
    },
  ],
});

const brief = optimisationBriefSchema.parse({
  schemaVersion: 1,
  generatedAt: '2026-07-30T15:00:00.000Z',
  windowMinutes: 30,
  sampleSize: 4,
  scores: {
    premiseClarity: 7,
    comedyEscalation: 7,
    dialogueCoherence: 7,
    visualMatch: 6,
    paceVariety: 6,
    originality: 7,
    shareability: 6,
  },
  delivery: {
    isLive: true,
    silenceRatio: 0,
    freezeRatio: 0,
    fallbackOccurrences: 0,
    concurrentViewers: 3,
  },
  increaseFormats: ['ident'],
  increasePacing: ['interrupted'],
  avoidMotifs: [],
  preserveStrengths: [],
  editorialDirection: 'Increase concrete action and visibly distinct production grammar.',
});

describe('asset growth planning', () => {
  it('prioritises the most underrepresented production family', () => {
    const request = nextAssetGrowthRequest(manifest, new Set(), brief);
    expect(request?.kind).toBe('sound_effect');
    expect(request?.constraints.length).toBeGreaterThanOrEqual(6);
    expect(request?.evidence.visualMatchScore).toBe(6);
  });

  it('moves to a different frontier when a request already exists', () => {
    const first = nextAssetGrowthRequest(manifest, new Set(), brief);
    const second = nextAssetGrowthRequest(
      manifest,
      new Set(first === null ? [] : [first.requestKey]),
      brief,
    );
    expect(second?.requestKey).not.toBe(first?.requestKey);
  });

  it('produces stable, schema-valid request identifiers', () => {
    const request = nextAssetGrowthRequest(manifest, new Set(), null, '2026-07-30T15:12:34.000Z');
    expect(request?.requestId).toBe('asset_request_20260730151234_sound_effect_domestic_mechanism');
  });
});
