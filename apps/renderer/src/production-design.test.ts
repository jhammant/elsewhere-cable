import { describe, expect, it } from 'vitest';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { resolveProductionDesign } from './production-design.js';

function segment(overrides: {
  channelNumber: number;
  programmeId: string;
  format: SegmentPackage['programme']['format'];
}): SegmentPackage {
  return {
    schemaVersion: 1,
    segmentId: `seg_${overrides.programmeId}`,
    channel: {
      id: `channel_${overrides.channelNumber}`,
      number: overrides.channelNumber,
      name: 'Test channel',
      realityId: 'TEST-REALITY',
    },
    programme: {
      id: overrides.programmeId,
      title: 'Test programme',
      format: overrides.format,
      premise: 'A test premise.',
    },
    durationMs: 5_000,
    visualStyle: 'test',
    tone: ['dry'],
    events: [{ atMs: 0, type: 'camera.cut', camera: 'CAMERA_WIDE' }],
    continuityUpdates: [],
    suggestedExit: {
      earliestMs: 4_000,
      preferredMs: 5_000,
      transition: 'HARD_CUT',
    },
    production: {
      generatedAt: new Date().toISOString(),
      generator: 'test',
      model: 'test',
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: false,
    },
  };
}

describe('resolveProductionDesign', () => {
  it('gives legacy programmes intentionally different media and cast grammars', () => {
    const designs = [
      resolveProductionDesign(
        segment({ channelNumber: 42, programmeId: 'dream_appeal', format: 'public_access' }),
      ),
      resolveProductionDesign(
        segment({ channelNumber: 8, programmeId: 'roundabout_news', format: 'news' }),
      ),
      resolveProductionDesign(
        segment({ channelNumber: 113, programmeId: 'orbit_time', format: 'ident' }),
      ),
      resolveProductionDesign(
        segment({ channelNumber: 17, programmeId: 'the_bureau', format: 'public_access' }),
      ),
      resolveProductionDesign(
        segment({ channelNumber: 802, programmeId: 'discount_dimension', format: 'shopping' }),
      ),
    ];

    expect(new Set(designs.map((design) => design.visualMedium)).size).toBe(5);
    expect(new Set(designs.map((design) => design.castArchetype)).size).toBeGreaterThanOrEqual(4);
  });

  it('honours explicit production choices from Ghost', () => {
    const explicit = segment({ channelNumber: 5, programmeId: 'manual', format: 'advert' });
    explicit.visualMedium = 'stop_motion';
    explicit.castArchetype = 'talking_objects';

    expect(resolveProductionDesign(explicit)).toEqual({
      visualMedium: 'stop_motion',
      castArchetype: 'talking_objects',
    });
  });
});
