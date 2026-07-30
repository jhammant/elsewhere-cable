import { describe, expect, it } from 'vitest';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { continuityCopyForSegment } from './continuity-copy.js';

function segment(index: number): SegmentPackage {
  return {
    schemaVersion: 1,
    segmentId: `seg_continuity_${index}`,
    channel: {
      id: `channel_${80_000_000 + index}`,
      number: 80_000_000 + index,
      name: `Continuity Channel ${index}`,
      realityId: `COPY-${index}`,
    },
    programme: {
      id: `continuity_programme_${index}`,
      title: `Continuity Programme ${index}`,
      format: 'public_access',
      premise: 'A small committee disagrees about the official direction of a desk.',
    },
    durationMs: 20_000,
    visualStyle: index % 2 === 0 ? 'paper hearing' : 'neon diagram',
    visualMedium: index % 2 === 0 ? 'paper_cutout' : 'neon_wireframe',
    castArchetype: 'paper_puppets',
    pacing: 'staccato',
    tone: ['dry'],
    events: [{ atMs: 0, type: 'camera.cut', camera: 'CAMERA_WIDE' }],
    continuityUpdates: [],
    suggestedExit: {
      earliestMs: 18_000,
      preferredMs: 20_000,
      transition: 'STATIC_BURST',
    },
    production: {
      generatedAt: '2026-07-30T07:00:00.000Z',
      generator: 'test',
      model: 'test',
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: true,
    },
  };
}

describe('continuity copy', () => {
  it('is stable for the same received segment', () => {
    expect(continuityCopyForSegment(segment(4))).toEqual(continuityCopyForSegment(segment(4)));
  });

  it('varies the network voice across a run of unrelated channels', () => {
    const copies = Array.from({ length: 24 }, (_, index) =>
      continuityCopyForSegment(segment(index)),
    );
    const signatures = new Set(
      copies.map(
        (copy) =>
          `${copy.networkEyebrow}|${copy.signalStatus}|${copy.nowLabel}|${copy.nextLabel}|${copy.integrity}|${copy.compatibility}`,
      ),
    );

    expect(signatures.size).toBeGreaterThanOrEqual(20);
    expect(new Set(copies.map((copy) => copy.signalStatus)).size).toBeGreaterThanOrEqual(8);
    expect(
      new Set(copies.map((copy) => copy.graphicKickers.titleCard)).size,
    ).toBeGreaterThanOrEqual(5);
  });
});
