import { appendFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  audiencePatternCatalog,
  createSanitizedAudienceResearchBrief,
  type AudiencePatternId,
  type SanitizedAudienceEvidence,
} from '../../apps/generation-worker/src/audience-research.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(argument(name) ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`--${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function parseCandidates(value: string): SanitizedAudienceEvidence[] {
  const allowed = new Set<string>(audiencePatternCatalog.map((pattern) => pattern.id));
  const candidates = value.split(',').map((record) => {
    const [pattern, evidenceCountText, sampleShareText, velocityText, ...remainder] =
      record.split(':');
    const evidenceCount = Number(evidenceCountText);
    const sampleShare = Number(sampleShareText);
    const relativeViewVelocity = Number(velocityText);
    if (
      remainder.length > 0 ||
      pattern === undefined ||
      !allowed.has(pattern) ||
      !Number.isInteger(evidenceCount) ||
      evidenceCount < 2 ||
      evidenceCount > 500 ||
      !Number.isFinite(sampleShare) ||
      sampleShare < 0 ||
      sampleShare > 1 ||
      !Number.isFinite(relativeViewVelocity) ||
      relativeViewVelocity < 0 ||
      relativeViewVelocity > 100
    ) {
      throw new Error(
        '--candidates must contain only pattern:evidenceCount:sampleShare:relativeViewVelocity records',
      );
    }
    return {
      pattern: pattern as AudiencePatternId,
      evidenceCount,
      sampleShare,
      relativeViewVelocity,
    };
  });
  if (candidates.length === 0 || candidates.length > 5) {
    throw new Error('--candidates must contain one to five records');
  }
  return candidates;
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const outputPath = path.resolve(
  workspaceRoot,
  argument('output') ?? 'data/research/latest.json',
);
const historyPath = path.resolve(
  workspaceRoot,
  argument('history') ?? 'data/research/history.ndjson',
);
const candidates = parseCandidates(
  argument('candidates') ??
    'live_occasion:3:0.1:1,explanation:2:0.067:1,reveal_chain:2:0.067:1',
);
const brief = createSanitizedAudienceResearchBrief(candidates, {
  generatedAt: new Date().toISOString(),
  region: (argument('region') ?? 'GB').toUpperCase(),
  categoryId: argument('category') ?? '24',
  sampleSize: boundedInteger('sample-size', 30, 1, 500),
});

await mkdir(path.dirname(outputPath), { recursive: true });
const nextPath = `${outputPath}.next`;
await writeFile(nextPath, `${JSON.stringify(brief, null, 2)}\n`, 'utf8');
await rename(nextPath, outputPath);
await appendFile(historyPath, `${JSON.stringify(brief)}\n`, 'utf8');
process.stdout.write(
  `${JSON.stringify({
    status: 'recorded',
    source: brief.source,
    generatedAt: brief.generatedAt,
    sampleSize: brief.sampleSize,
    candidates: brief.candidates.map((candidate) => candidate.pattern),
    outputPath,
  })}\n`,
);
