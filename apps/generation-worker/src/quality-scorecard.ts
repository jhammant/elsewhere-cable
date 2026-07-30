import type { OptimisationBrief } from '@elsewhere-cable/schemas';

export interface QualityScorecard {
  generatedAt: string;
  sampleSize: number;
  editorial: number;
  reliability: number | null;
  novelty: number | null;
  diversity: number | null;
  experienceIndex: number;
  freshRunwayHours: number | null;
  runwayReadiness: number | null;
  concurrentViewers: number | null;
  evidenceCoverage: number;
  guardrails: {
    live: boolean | null;
    noFallback: boolean;
    audioPresent: boolean | null;
    visuallyMoving: boolean | null;
    sufficientlyNovel: boolean | null;
    enoughSamples: boolean;
    passed: boolean;
  };
}

export type ExperimentDecision = 'keep' | 'discard' | 'inconclusive';

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number): number {
  return Number(value.toFixed(1));
}

function weightedAverage(
  values: ReadonlyArray<{ value: number | null; weight: number }>,
): number | null {
  const available = values.filter(
    (entry): entry is { value: number; weight: number } => entry.value !== null,
  );
  const weight = available.reduce((total, entry) => total + entry.weight, 0);
  if (weight === 0) {
    return null;
  }
  return available.reduce((total, entry) => total + entry.value * entry.weight, 0) / weight;
}

function lowerIsBetter(value: number, healthyCeiling: number, failureCeiling: number): number {
  if (value <= healthyCeiling) {
    return 100;
  }
  return clamp(100 - ((value - healthyCeiling) / (failureCeiling - healthyCeiling)) * 100);
}

export function qualityScorecard(
  brief: OptimisationBrief,
  options: { freshRunwayHours?: number | null } = {},
): QualityScorecard {
  const editorial =
    (Object.values(brief.scores).reduce((total, score) => total + score, 0) /
      Object.values(brief.scores).length) *
    10;
  const delivery = brief.delivery;
  const reliability = weightedAverage([
    {
      value: delivery.isLive === null ? null : delivery.isLive ? 100 : 0,
      weight: 0.3,
    },
    {
      value: clamp(100 - delivery.fallbackOccurrences * 35),
      weight: 0.2,
    },
    {
      value:
        delivery.silenceRatio === null ? null : lowerIsBetter(delivery.silenceRatio, 0.15, 0.5),
      weight: 0.25,
    },
    {
      value: delivery.freezeRatio === null ? null : lowerIsBetter(delivery.freezeRatio, 0.18, 0.6),
      weight: 0.25,
    },
  ]);
  const window = brief.windowMetrics;
  const novelty = window === undefined ? null : clamp(window.programmeUniquenessRatio * 100);
  const diversity =
    window === undefined
      ? null
      : weightedAverage([
          { value: clamp((window.uniqueFormats / 7) * 100), weight: 0.25 },
          { value: clamp((window.uniqueVisualMedia / 22) * 100), weight: 0.35 },
          { value: clamp((window.uniqueCastArchetypes / 6) * 100), weight: 0.2 },
          { value: clamp((window.uniquePacingModes / 6) * 100), weight: 0.2 },
        ]);
  const experienceIndex =
    weightedAverage([
      { value: editorial, weight: 0.4 },
      { value: reliability, weight: 0.25 },
      { value: novelty, weight: 0.2 },
      { value: diversity, weight: 0.15 },
    ]) ?? editorial;
  const freshRunwayHours = options.freshRunwayHours ?? null;
  const runwayReadiness = freshRunwayHours === null ? null : clamp((freshRunwayHours / 24) * 100);
  const live = delivery.isLive;
  const noFallback = delivery.fallbackOccurrences === 0;
  const audioPresent = delivery.silenceRatio === null ? null : delivery.silenceRatio < 0.15;
  const visuallyMoving = delivery.freezeRatio === null ? null : delivery.freezeRatio < 0.18;
  const sufficientlyNovel = window === undefined ? null : window.programmeUniquenessRatio >= 0.8;
  const enoughSamples = brief.sampleSize >= 20;
  const definiteGuardrails = [live, noFallback, audioPresent, visuallyMoving, sufficientlyNovel];
  const passed =
    enoughSamples &&
    definiteGuardrails.every((value) => value !== false) &&
    definiteGuardrails.filter((value) => value !== null).length >= 4;
  const evidenceSignals = [
    brief.sampleSize >= 20,
    delivery.isLive !== null,
    delivery.silenceRatio !== null,
    delivery.freezeRatio !== null,
    window !== undefined,
    delivery.concurrentViewers !== null,
  ];

  return {
    generatedAt: brief.generatedAt,
    sampleSize: brief.sampleSize,
    editorial: rounded(editorial),
    reliability: reliability === null ? null : rounded(reliability),
    novelty: novelty === null ? null : rounded(novelty),
    diversity: diversity === null ? null : rounded(diversity),
    experienceIndex: rounded(experienceIndex),
    freshRunwayHours: freshRunwayHours === null ? null : rounded(freshRunwayHours),
    runwayReadiness: runwayReadiness === null ? null : rounded(runwayReadiness),
    concurrentViewers: delivery.concurrentViewers,
    evidenceCoverage: rounded(
      (evidenceSignals.filter(Boolean).length / evidenceSignals.length) * 100,
    ),
    guardrails: {
      live,
      noFallback,
      audioPresent,
      visuallyMoving,
      sufficientlyNovel,
      enoughSamples,
      passed,
    },
  };
}

export function decideExperiment(
  baseline: QualityScorecard,
  candidate: QualityScorecard,
  minimumGain = 1,
): ExperimentDecision {
  if (!candidate.guardrails.passed) {
    return 'discard';
  }
  if (
    !baseline.guardrails.passed ||
    baseline.evidenceCoverage < 80 ||
    candidate.evidenceCoverage < 80
  ) {
    return 'inconclusive';
  }
  return candidate.experienceIndex >= baseline.experienceIndex + minimumGain ? 'keep' : 'discard';
}
