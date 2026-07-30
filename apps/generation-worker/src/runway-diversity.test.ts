import { describe, expect, it } from 'vitest';
import {
  diversifyRunway,
  runwayDiversityMetrics,
  type RunwayDescriptor,
} from './runway-diversity.js';

function descriptor(
  segmentId: string,
  format: string,
  visualMedium: string,
  pacing: string,
): RunwayDescriptor {
  return {
    segmentId,
    channelId: `channel_${segmentId}`,
    programmeId: `programme_${segmentId}`,
    format,
    visualMedium,
    castArchetype: `cast_${segmentId}`,
    pacing,
    storyMode: `story_${segmentId}`,
  };
}

describe('runway diversity', () => {
  it('separates repeated formats, media and low-energy pacing when alternatives exist', () => {
    const original = [
      descriptor('a', 'news', 'archive_film', 'near_silent'),
      descriptor('b', 'news', 'archive_film', 'slow_burn'),
      descriptor('c', 'news', 'archive_film', 'conversational'),
      descriptor('d', 'advert', 'paper_cutout', 'frantic'),
      descriptor('e', 'sitcom', 'cel_shaded', 'staccato'),
      descriptor('f', 'ident', 'neon_wireframe', 'interrupted'),
    ];

    const diversified = diversifyRunway(original);
    const metrics = runwayDiversityMetrics(diversified);

    expect(metrics.lowEnergyAdjacencies).toBe(0);
    expect(metrics.sameFormatAdjacencies).toBeLessThan(
      runwayDiversityMetrics(original).sameFormatAdjacencies,
    );
    expect(metrics.sameMediumAdjacencies).toBeLessThan(
      runwayDiversityMetrics(original).sameMediumAdjacencies,
    );
  });

  it('separates cast families when a broader candidate window provides alternatives', () => {
    const original = [
      { ...descriptor('a', 'news', 'archive_film', 'frantic'), castArchetype: 'mixed' },
      { ...descriptor('b', 'news', 'archive_film', 'frantic'), castArchetype: 'mixed' },
      { ...descriptor('c', 'news', 'archive_film', 'frantic'), castArchetype: 'mixed' },
      {
        ...descriptor('d', 'sitcom', 'paper_cutout', 'staccato'),
        castArchetype: 'paper_puppets',
      },
      {
        ...descriptor('e', 'advert', 'claymation', 'conversational'),
        castArchetype: 'talking_objects',
      },
      {
        ...descriptor('f', 'ident', 'neon_wireframe', 'interrupted'),
        castArchetype: 'celestial',
      },
    ];

    const diversified = diversifyRunway(original);
    expect(
      new Set(diversified.slice(0, 4).map(({ castArchetype }) => castArchetype)).size,
    ).toBe(4);
    expect(runwayDiversityMetrics(diversified).sameCastAdjacencies).toBeLessThan(
      runwayDiversityMetrics(original).sameCastAdjacencies,
    );
  });

  it('is deterministic and preserves every segment exactly once', () => {
    const original = [
      descriptor('a', 'news', 'archive_film', 'conversational'),
      descriptor('b', 'advert', 'paper_cutout', 'frantic'),
      descriptor('c', 'sitcom', 'cel_shaded', 'slow_burn'),
      descriptor('d', 'ident', 'neon_wireframe', 'interrupted'),
    ];

    const first = diversifyRunway(original);
    const second = diversifyRunway(original);

    expect(first).toEqual(second);
    expect(first.map(({ segmentId }) => segmentId).sort()).toEqual(
      original.map(({ segmentId }) => segmentId).sort(),
    );
  });
});
