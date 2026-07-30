import { execFile } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import {
  optimisationBriefSchema,
  type OptimisationBrief,
} from '../../packages/schemas/src/index.js';
import {
  decideExperiment,
  qualityScorecard,
  type ExperimentDecision,
  type QualityScorecard,
} from '../../apps/generation-worker/src/quality-scorecard.js';
import { rankExperimentArms } from '../../apps/generation-worker/src/experiment-arms.js';
import type { AudienceResearchBrief } from '../../apps/generation-worker/src/audience-research.js';

const execFileAsync = promisify(execFile);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

interface ExperimentRecord {
  schemaVersion: 1;
  experimentId: string;
  startedAt: string;
  build: string;
  surface: string;
  hypothesis: string;
  status: 'active' | 'keep' | 'discard' | 'crash';
}

interface RunwayProbe {
  contentFresh?: { hours?: number };
  contentRepeatReserve?: { hours?: number };
  idUnseen?: { hours?: number };
}

interface GenerationObservation {
  generatedAt: string;
  status: 'approved' | 'rejected';
  strategy?: string;
  revision?: string;
  requestedScripts: number;
  proposalAttempts: number;
  durationSeconds: number;
  pendingDelta: number;
  completedDelta: number;
  pendingScripts: number;
  completedScripts: number;
}

async function readNdjson<T>(filePath: string, parse: (value: unknown) => T): Promise<T[]> {
  try {
    return (await readFile(filePath, 'utf8'))
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== '')
      .flatMap((line) => {
        try {
          return [parse(JSON.parse(line))];
        } catch {
          return [];
        }
      });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readAudienceResearch(filePath: string): Promise<AudienceResearchBrief | null> {
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8')) as Partial<AudienceResearchBrief>;
    if (
      value.schemaVersion !== 1 ||
      value.source !== 'youtube_most_popular' ||
      typeof value.generatedAt !== 'string' ||
      !Array.isArray(value.candidates) ||
      value.privacy?.sourceTextRetained !== false ||
      value.privacy.descriptionsIngested !== false ||
      value.privacy.rawTextAllowedInPrompts !== false
    ) {
      return null;
    }
    return value as AudienceResearchBrief;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

function parseExperiment(value: unknown): ExperimentRecord {
  const record = value as Partial<ExperimentRecord>;
  if (
    record.schemaVersion !== 1 ||
    typeof record.experimentId !== 'string' ||
    typeof record.startedAt !== 'string' ||
    typeof record.build !== 'string' ||
    typeof record.surface !== 'string' ||
    typeof record.hypothesis !== 'string' ||
    !['active', 'keep', 'discard', 'crash'].includes(record.status ?? '')
  ) {
    throw new Error('Invalid experiment record');
  }
  return record as ExperimentRecord;
}

function parseGenerationObservation(value: unknown): GenerationObservation {
  const record = value as Partial<GenerationObservation>;
  if (
    typeof record.generatedAt !== 'string' ||
    !['approved', 'rejected'].includes(record.status ?? '') ||
    (record.strategy !== undefined &&
      (typeof record.strategy !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/u.test(record.strategy))) ||
    (record.revision !== undefined &&
      (typeof record.revision !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/u.test(record.revision))) ||
    !Number.isInteger(record.requestedScripts) ||
    !Number.isInteger(record.proposalAttempts) ||
    !Number.isInteger(record.durationSeconds) ||
    !Number.isInteger(record.pendingDelta) ||
    !Number.isInteger(record.completedDelta) ||
    !Number.isInteger(record.pendingScripts) ||
    !Number.isInteger(record.completedScripts)
  ) {
    throw new Error('Invalid generation observation');
  }
  return record as GenerationObservation;
}

async function runwayProbe(
  workspaceRoot: string,
  segmentsRoot: string,
  playedIdsPath: string,
): Promise<RunwayProbe | null> {
  try {
    const result = await execFileAsync(
      path.join(workspaceRoot, 'node_modules/.bin/tsx'),
      [
        path.join(workspaceRoot, 'infra/scripts/content-runway.ts'),
        '--segments',
        segmentsRoot,
        '--played-ids',
        playedIdsPath,
      ],
      { timeout: 120_000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
    );
    return JSON.parse(result.stdout) as RunwayProbe;
  } catch {
    return null;
  }
}

function average(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function change(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : Number((current - previous).toFixed(1));
}

function lastIndexMatching<T>(
  values: readonly T[],
  predicate: (value: T, index: number) => boolean,
): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== undefined && predicate(value, index)) {
      return index;
    }
  }
  return -1;
}

function formatDelta(value: number | null): string {
  if (value === null) {
    return 'unknown';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

function experimentEvaluation(
  experiment: ExperimentRecord | null,
  briefs: readonly OptimisationBrief[],
  scores: readonly QualityScorecard[],
): {
  experiment: ExperimentRecord | null;
  baseline: QualityScorecard | null;
  candidate: QualityScorecard | null;
  decision: ExperimentDecision | 'waiting' | null;
} {
  if (experiment === null) {
    return { experiment: null, baseline: null, candidate: null, decision: null };
  }
  const startedAt = Date.parse(experiment.startedAt);
  const baselineIndex = lastIndexMatching(
    briefs,
    (brief) => Date.parse(brief.generatedAt) < startedAt,
  );
  const baseline = baselineIndex < 0 ? null : (scores[baselineIndex] ?? null);
  const eligibleAt = startedAt + (briefs.at(-1)?.windowMinutes ?? 30) * 60_000;
  const candidateIndex = lastIndexMatching(
    briefs,
    (brief) => Date.parse(brief.generatedAt) >= eligibleAt,
  );
  const candidate = candidateIndex < 0 ? null : (scores[candidateIndex] ?? null);
  return {
    experiment,
    baseline,
    candidate,
    decision:
      baseline === null || candidate === null
        ? 'waiting'
        : decideExperiment(baseline, candidate, 1, experiment.surface),
  };
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const historyPath = path.resolve(
  workspaceRoot,
  argument('history') ?? 'data/optimisation/history.ndjson',
);
const experimentsPath = path.resolve(
  workspaceRoot,
  argument('experiments') ?? 'data/optimisation/experiments.ndjson',
);
const outputPath = path.resolve(
  workspaceRoot,
  argument('output') ?? 'data/optimisation/scorecard.json',
);
const reportPath = path.resolve(
  workspaceRoot,
  argument('report') ?? 'data/optimisation/progress.md',
);
const segmentsRoot = path.resolve(
  workspaceRoot,
  argument('segments') ?? process.env.ELSEWHERE_LIVE_SEGMENTS_DIR ?? 'data/segments-live',
);
const playedIdsPath = path.resolve(
  workspaceRoot,
  argument('played-ids') ?? 'data/runtime/played-segment-ids.txt',
);
const audienceResearchPath = path.resolve(
  workspaceRoot,
  argument('audience-research') ?? 'data/research/latest.json',
);
const generationHistoryPath = path.resolve(
  workspaceRoot,
  argument('generation-history') ?? 'data/optimisation/generation-history.ndjson',
);

const briefs = await readNdjson(historyPath, (value) => optimisationBriefSchema.parse(value));
if (briefs.length === 0) {
  throw new Error(`No valid optimisation observations found in ${historyPath}`);
}
const runway = await runwayProbe(workspaceRoot, segmentsRoot, playedIdsPath);
const scores = briefs.map((brief, index) =>
  qualityScorecard(brief, {
    freshRunwayHours: index === briefs.length - 1 ? (runway?.contentFresh?.hours ?? null) : null,
  }),
);
const experiments = await readNdjson(experimentsPath, parseExperiment);
const latestExperimentStates = new Map<string, ExperimentRecord>();
for (const experiment of experiments) {
  latestExperimentStates.set(experiment.experimentId, experiment);
}
const activeExperiment =
  [...latestExperimentStates.values()]
    .reverse()
    .find((experiment) => experiment.status === 'active') ?? null;
const evaluation = experimentEvaluation(activeExperiment, briefs, scores);
const latest = scores.at(-1)!;
const recommendedArms = rankExperimentArms(latest).slice(0, 6);
const audienceResearch = await readAudienceResearch(audienceResearchPath);
const generationHistory = await readNdjson(generationHistoryPath, parseGenerationObservation);
const recentGeneration = generationHistory.slice(-24);
const approvedGeneration = recentGeneration.filter(
  (observation) => observation.status === 'approved',
);
const generatedScriptCount = approvedGeneration.reduce(
  (total, observation) => total + Math.max(0, observation.pendingDelta),
  0,
);
const generationWallSeconds = recentGeneration.reduce(
  (total, observation) => total + observation.durationSeconds,
  0,
);
const generationByStrategy = new Map<string, GenerationObservation[]>();
for (const observation of recentGeneration) {
  const strategy = observation.strategy ?? 'legacy-unattributed';
  const revision = observation.revision ?? 'unknown';
  const key = `${strategy}@${revision}`;
  generationByStrategy.set(key, [...(generationByStrategy.get(key) ?? []), observation]);
}
const generationStrategies = [...generationByStrategy.entries()].map(([key, observations]) => {
  const [strategy, revision] = key.split('@', 2) as [string, string];
  const approved = observations.filter((observation) => observation.status === 'approved');
  const approvedScripts = approved.reduce(
    (total, observation) => total + Math.max(0, observation.pendingDelta),
    0,
  );
  const computeSeconds = observations.reduce(
    (total, observation) => total + observation.durationSeconds,
    0,
  );
  return {
    strategy,
    revision,
    batches: observations.length,
    approvedBatches: approved.length,
    approvedScripts,
    computeSeconds,
    scriptsPerGenerationHour:
      computeSeconds === 0 ? null : Number((approvedScripts / (computeSeconds / 3_600)).toFixed(2)),
  };
});
const previous = scores.at(-2) ?? null;
const comparableScores = scores.filter(
  (score) => score.novelty !== null && score.evidenceCoverage >= 80,
);
const comparableBaseline = comparableScores[0] ?? null;
const recent = scores.slice(-6);
const previousRecent = scores.slice(-12, -6);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  observationCount: scores.length,
  comparableObservationCount: comparableScores.length,
  latest,
  changes: {
    versusPrevious: change(latest.experienceIndex, previous?.experienceIndex ?? null),
    versusComparableBaseline: change(
      latest.experienceIndex,
      comparableBaseline?.experienceIndex ?? null,
    ),
    recentSixAverage: Number(
      (average(recent.map((score) => score.experienceIndex)) ?? latest.experienceIndex).toFixed(1),
    ),
    previousSixAverage:
      previousRecent.length === 0
        ? null
        : Number(average(previousRecent.map((score) => score.experienceIndex))!.toFixed(1)),
  },
  runway: {
    freshHours: runway?.contentFresh?.hours ?? null,
    repeatReserveHours: runway?.contentRepeatReserve?.hours ?? null,
    idUnseenHours: runway?.idUnseen?.hours ?? null,
  },
  experiment: evaluation,
  audience: {
    concurrentViewers: latest.concurrentViewers,
    note: 'Public metadata exposes concurrent viewers. Watch time and retention require authenticated YouTube Analytics.',
  },
  audienceResearch,
  generation: {
    observedBatches: recentGeneration.length,
    approvedBatches: approvedGeneration.length,
    approvalRate:
      recentGeneration.length === 0
        ? null
        : Number(((approvedGeneration.length / recentGeneration.length) * 100).toFixed(1)),
    approvedScripts: generatedScriptCount,
    scriptsPerGenerationHour:
      generationWallSeconds === 0
        ? null
        : Number((generatedScriptCount / (generationWallSeconds / 3_600)).toFixed(2)),
    latestStatus: recentGeneration.at(-1)?.status ?? null,
    latestAt: recentGeneration.at(-1)?.generatedAt ?? null,
    latestStrategy: recentGeneration.at(-1)?.strategy ?? null,
    latestRevision: recentGeneration.at(-1)?.revision ?? null,
    strategies: generationStrategies,
  },
  recommendedArms,
  history: scores,
};

const nextOutputPath = `${outputPath}.next`;
await writeFile(nextOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await rename(nextOutputPath, outputPath);
const recentDelta =
  report.changes.previousSixAverage === null
    ? null
    : report.changes.recentSixAverage - report.changes.previousSixAverage;
const progressMarkdown = `# Elsewhere Cable optimisation scorecard

Generated ${report.generatedAt}

## Comparable primary metric

- Experience index: **${latest.experienceIndex.toFixed(1)} / 100**
- Versus previous observation: **${formatDelta(report.changes.versusPrevious)}**
- Versus first comparable observation: **${formatDelta(report.changes.versusComparableBaseline)}**
- Six-window average: **${report.changes.recentSixAverage.toFixed(1)}** (${formatDelta(
  recentDelta,
)} versus the preceding six)
- Evidence coverage: **${latest.evidenceCoverage.toFixed(0)}%**
- Guardrails: **${latest.guardrails.passed ? 'pass' : 'fail'}**

The primary metric combines editorial quality (40%), delivered reliability (25%), programme
novelty (20%) and format/medium/cast/pacing diversity (15%). Audience size is deliberately
reported separately so a tiny early audience cannot distort the quality evaluator.

## Current components

- Editorial: ${latest.editorial.toFixed(1)}
- Reliability: ${latest.reliability?.toFixed(1) ?? 'unknown'}
- Novelty: ${latest.novelty?.toFixed(1) ?? 'unknown'}
- Diversity: ${latest.diversity?.toFixed(1) ?? 'unknown'}
- Direct visual quality: ${latest.visualQuality?.toFixed(1) ?? 'unknown'}
- Concurrent viewers: ${latest.concurrentViewers ?? 'unknown'}

## Runway

- Genuinely fresh: ${report.runway.freshHours?.toFixed(2) ?? 'unknown'} hours
- Repeat reserve: ${report.runway.repeatReserveHours?.toFixed(2) ?? 'unknown'} hours
- ID-unseen total: ${report.runway.idUnseenHours?.toFixed(2) ?? 'unknown'} hours

## Script generation

- Recent batches observed: ${report.generation.observedBatches}
- Batch approval rate: ${report.generation.approvalRate?.toFixed(1) ?? 'unknown'}%
- New approved scripts: ${report.generation.approvedScripts}
- Generation throughput: ${report.generation.scriptsPerGenerationHour?.toFixed(2) ?? 'unknown'} scripts per compute-hour
- Latest batch: ${report.generation.latestStatus ?? 'unknown'}
- Latest strategy: ${report.generation.latestStrategy ?? 'unknown'}
- Latest revision: ${report.generation.latestRevision ?? 'unknown'}

${report.generation.strategies
  .map(
    (strategy) =>
      `- ${strategy.strategy}@${strategy.revision}: ${strategy.approvedScripts} scripts from ${strategy.batches} batches in ${(strategy.computeSeconds / 60).toFixed(1)} compute-minutes (${strategy.scriptsPerGenerationHour?.toFixed(2) ?? 'unknown'} scripts/hour)`,
  )
  .join('\n')}

## Active experiment

${
  evaluation.experiment === null
    ? 'No experiment is currently registered.'
    : `- ID: ${evaluation.experiment.experimentId}
- Build: ${evaluation.experiment.build}
- Surface: ${evaluation.experiment.surface}
- Hypothesis: ${evaluation.experiment.hypothesis}
- Decision: ${evaluation.decision}`
}

## Audience outcome

${report.audience.note}

## Audience research

${
  audienceResearch === null
    ? 'No current public-pattern brief is available. Configure the read-only YouTube Data API research worker.'
    : `Sampled ${audienceResearch.sampleSize} popular videos in ${audienceResearch.region}. Candidate mechanisms:
${audienceResearch.candidates
  .map((candidate, index) => `${index + 1}. **${candidate.pattern}** — ${candidate.hypothesis}`)
  .join('\n')}`
}

## Recommended experiment arms

${recommendedArms.map((arm, index) => `${index + 1}. **${arm.id}** — ${arm.reason}`).join('\n')}
`;
const nextReportPath = `${reportPath}.next`;
await writeFile(nextReportPath, progressMarkdown, 'utf8');
await rename(nextReportPath, reportPath);
process.stdout.write(
  `${JSON.stringify(
    process.argv.includes('--quiet')
      ? {
          generatedAt: report.generatedAt,
          experienceIndex: report.latest.experienceIndex,
          guardrailsPassed: report.latest.guardrails.passed,
          evidenceCoverage: report.latest.evidenceCoverage,
          freshRunwayHours: report.runway.freshHours,
          activeExperiment: report.experiment.experiment?.experimentId ?? null,
          decision: report.experiment.decision,
          outputPath,
          reportPath,
        }
      : report,
    null,
    2,
  )}\n`,
);
