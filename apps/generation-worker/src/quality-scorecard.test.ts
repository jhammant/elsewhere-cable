import { describe, expect, it } from 'vitest';
import type { OptimisationBrief } from '@elsewhere-cable/schemas';
import { decideExperiment, qualityScorecard } from './quality-scorecard.js';

function brief(overrides: Partial<OptimisationBrief> = {}): OptimisationBrief {
  return {
    schemaVersion: 1,
    generatedAt: '2026-07-30T10:01:19.303Z',
    windowMinutes: 30,
    sampleSize: 60,
    scores: {
      premiseClarity: 8,
      comedyEscalation: 8,
      dialogueCoherence: 7,
      visualMatch: 9,
      paceVariety: 8,
      originality: 9,
      shareability: 7,
    },
    increaseFormats: [],
    increasePacing: [],
    avoidMotifs: [],
    preserveStrengths: [],
    editorialDirection: 'Preserve legibility while increasing visible consequences.',
    delivery: {
      isLive: true,
      concurrentViewers: 3,
      silenceRatio: 0.06,
      freezeRatio: 0.04,
      fallbackOccurrences: 0,
    },
    windowMetrics: {
      uniqueProgrammes: 57,
      programmeRepeats: 3,
      programmeUniquenessRatio: 0.95,
      uniqueFormats: 7,
      uniqueVisualMedia: 17,
      uniqueCastArchetypes: 6,
      uniquePacingModes: 6,
    },
    ...overrides,
  };
}

describe('channel quality scorecard', () => {
  it('keeps audience size out of the quality index', () => {
    const lowAudience = qualityScorecard(brief());
    const highAudience = qualityScorecard(
      brief({ delivery: { ...brief().delivery, concurrentViewers: 10_000 } }),
    );
    expect(highAudience.experienceIndex).toBe(lowAudience.experienceIndex);
    expect(highAudience.concurrentViewers).toBe(10_000);
  });

  it('fails hard reliability and originality guardrails', () => {
    const result = qualityScorecard(
      brief({
        delivery: {
          isLive: true,
          concurrentViewers: 4,
          silenceRatio: 0.31,
          freezeRatio: 0.04,
          fallbackOccurrences: 0,
        },
        windowMetrics: {
          ...brief().windowMetrics!,
          programmeUniquenessRatio: 0.52,
        },
      }),
    );
    expect(result.guardrails.audioPresent).toBe(false);
    expect(result.guardrails.sufficientlyNovel).toBe(false);
    expect(result.guardrails.passed).toBe(false);
  });

  it('reports fresh runway against a 24-hour resilience target', () => {
    const result = qualityScorecard(brief(), { freshRunwayHours: 12 });
    expect(result.runwayReadiness).toBe(50);
    expect(result.freshRunwayHours).toBe(12);
  });

  it('reports direct visual evidence separately from text and delivery proxies', () => {
    const result = qualityScorecard(
      brief({
        visualQuality: {
          model: 'qwen/qwen3-vl-8b',
          sampledFrames: 6,
          composition: 7,
          legibility: 8,
          styleDistinctness: 8,
          visibleAction: 7,
          overlaySafety: 9,
          changeOfPace: 7,
          overall: 7.7,
          strongestEvidence: 'The sample contains two visibly distinct rendering systems.',
          biggestProblem: 'One flat scene contains overlapping background shapes.',
        },
      }),
    );

    expect(result.visualQuality).toBe(7.7);
  });

  it('keeps only measured gains that preserve every guardrail', () => {
    const baseline = qualityScorecard(brief());
    const better = qualityScorecard(
      brief({
        scores: {
          ...brief().scores,
          comedyEscalation: 10,
          shareability: 10,
        },
      }),
    );
    const unreliable = qualityScorecard(
      brief({
        delivery: {
          ...brief().delivery,
          silenceRatio: 0.45,
        },
      }),
    );
    expect(decideExperiment(baseline, better)).toBe('keep');
    expect(decideExperiment(baseline, unreliable)).toBe('discard');
  });

  it('does not decide from an under-observed window', () => {
    const baseline = qualityScorecard(brief({ sampleSize: 2 }));
    const candidate = qualityScorecard(brief());
    expect(decideExperiment(baseline, candidate)).toBe('inconclusive');
  });

  it('does not attribute unrelated editorial drift to a renderer experiment', () => {
    const baseline = qualityScorecard(brief());
    const editorialDrift = qualityScorecard(
      brief({
        scores: {
          ...brief().scores,
          comedyEscalation: 6,
          shareability: 5,
        },
      }),
    );
    const deliveryRegression = qualityScorecard(
      brief({
        delivery: {
          ...brief().delivery,
          silenceRatio: 0.25,
          freezeRatio: 0.25,
        },
      }),
    );

    expect(decideExperiment(baseline, editorialDrift, 1, 'renderer')).toBe('inconclusive');
    expect(decideExperiment(baseline, deliveryRegression, 1, 'renderer')).toBe('discard');
  });
});
