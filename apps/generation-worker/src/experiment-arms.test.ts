import { describe, expect, it } from 'vitest';
import { experimentArms, rankExperimentArms } from './experiment-arms.js';
import type { QualityScorecard } from './quality-scorecard.js';

function scorecard(overrides: Partial<QualityScorecard> = {}): QualityScorecard {
  return {
    generatedAt: '2026-07-30T10:01:19.303Z',
    sampleSize: 60,
    editorial: 82,
    reliability: 100,
    novelty: 96,
    diversity: 88,
    visualQuality: 85,
    experienceIndex: 89,
    freshRunwayHours: 24,
    runwayReadiness: 100,
    concurrentViewers: 3,
    evidenceCoverage: 100,
    guardrails: {
      live: true,
      noFallback: true,
      audioPresent: true,
      visuallyMoving: true,
      sufficientlyNovel: true,
      enoughSamples: true,
      passed: true,
    },
    ...overrides,
  };
}

describe('optimisation experiment arms', () => {
  it('keeps every capability as an explicit bounded arm', () => {
    const ids = new Set(experimentArms.map((arm) => arm.id));
    expect(ids.size).toBe(experimentArms.length);
    expect(ids).toContain('music');
    expect(ids).toContain('story_engine');
    expect(ids).toContain('runway');
    expect(ids).toContain('reliability');
    expect(ids).toContain('audience_research');
  });

  it('prioritises runway and originality before optional polish', () => {
    const ranked = rankExperimentArms(
      scorecard({
        editorial: 76,
        novelty: 51,
        freshRunwayHours: 0.1,
        runwayReadiness: 0.4,
      }),
    );
    expect(ranked[0]?.id).toBe('runway');
    expect(ranked.findIndex((arm) => arm.id === 'story_engine')).toBeLessThan(
      ranked.findIndex((arm) => arm.id === 'music'),
    );
  });

  it('puts reliability first when the public delivery score is weak', () => {
    const ranked = rankExperimentArms(scorecard({ reliability: 62 }));
    expect(ranked[0]?.id).toBe('reliability');
  });

  it('makes music a valid next experiment once all primary gates are healthy', () => {
    const ranked = rankExperimentArms(scorecard());
    expect(ranked[0]?.id).toBe('music');
  });
});
