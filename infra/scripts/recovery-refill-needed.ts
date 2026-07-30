import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';
import { recoveryRunwayDecision } from '../../apps/generation-worker/src/recovery-policy.js';

const execFileAsync = promisify(execFile);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function log(fields: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(fields)}\n`);
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const minimumAheadMinutes = Number(argument('minimum-ahead-minutes') ?? 30);
if (
  !Number.isFinite(minimumAheadMinutes) ||
  minimumAheadMinutes < 5 ||
  minimumAheadMinutes > 360
) {
  throw new Error('--minimum-ahead-minutes must be between 5 and 360');
}
const endorHost = argument('endor-host') ?? process.env.ELSEWHERE_ENDOR_HOST ?? 'endor';
const containerName = argument('container') ?? 'elsewhere-cable';
const manifest = playoutManifestSchema.parse(
  JSON.parse(await readFile(path.join(segmentsRoot, 'manifest.json'), 'utf8')),
);

let output = '';
try {
  const result = await execFileAsync(
    'ssh',
    [endorHost, 'docker', 'logs', '--since', '10m', '--tail', '20000', containerName],
    {
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  output = `${result.stdout}\n${result.stderr}`;
} catch (error) {
  log({
    needed: true,
    reason: 'endor-observation-failed',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(0);
}

let latestRequest: { segmentId: string; atMs: number } | null = null;
for (const line of output.split(/[\r\n]+/u)) {
  try {
    const record = JSON.parse(line) as {
      time?: unknown;
      req?: { method?: unknown; url?: unknown };
    };
    const url = record.req?.url;
    const match =
      record.req?.method === 'GET' && typeof url === 'string'
        ? url.match(/^\/api\/playout\/segments\/(seg_[a-z0-9_]+)$/u)
        : null;
    if (match !== null && typeof record.time === 'number') {
      if (latestRequest === null || record.time > latestRequest.atMs) {
        latestRequest = { segmentId: match[1]!, atMs: record.time };
      }
    }
  } catch {
    // Encoder progress and browser diagnostics share the same container log.
  }
}

if (latestRequest === null) {
  log({ needed: true, reason: 'no-recent-live-segment' });
  process.exit(0);
}

const currentEntry = manifest.segments.find(
  (entry) => entry.segmentId === latestRequest?.segmentId,
);
if (
  currentEntry === undefined ||
  Date.now() - latestRequest.atMs > currentEntry.durationMs + 20_000
) {
  log({
    needed: true,
    reason: currentEntry === undefined ? 'observed-segment-absent' : 'observation-stale',
    observedSegmentId: latestRequest.segmentId,
  });
  process.exit(0);
}

const decision = recoveryRunwayDecision(
  manifest,
  latestRequest.segmentId,
  minimumAheadMinutes * 60_000,
);
log({
  ...decision,
  observedSegmentId: latestRequest.segmentId,
  minimumAheadMinutes,
  aheadMinutes: Number((decision.aheadDurationMs / 60_000).toFixed(2)),
});
process.exit(decision.needed ? 0 : 1);
