import { execFile } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type SegmentPackage,
} from '../../packages/schemas/src/index.js';
import { prioritiseNewEntries } from '../../apps/generation-worker/src/live-priority.js';

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
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const newerThanValue = argument('newer-than');
const selectedIdsValue = argument('segment-ids');
if (newerThanValue !== undefined && selectedIdsValue !== undefined) {
  throw new Error('Use either --newer-than or --segment-ids, not both');
}
const selectedIds =
  selectedIdsValue === undefined
    ? []
    : selectedIdsValue
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
if (
  selectedIds.some((segmentId) => !/^seg_[a-z0-9_]+$/u.test(segmentId)) ||
  new Set(selectedIds).size !== selectedIds.length
) {
  throw new Error('--segment-ids must contain unique, comma-separated segment IDs');
}
if (
  selectedIds.length === 0 &&
  (newerThanValue === undefined || !Number.isFinite(Date.parse(newerThanValue)))
) {
  throw new Error('Provide --newer-than as an ISO timestamp or valid --segment-ids');
}
const newerThanMs = newerThanValue === undefined ? null : Date.parse(newerThanValue);
const lookahead = Number(argument('lookahead') ?? 3);
if (!Number.isInteger(lookahead) || lookahead < 1 || lookahead > 12) {
  throw new Error('--lookahead must be an integer from 1 to 12');
}
const endorHost = argument('endor-host') ?? process.env.ELSEWHERE_ENDOR_HOST ?? 'endor';
const containerName = argument('container') ?? 'elsewhere-cable';
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));

async function readSegment(packagePath: string): Promise<SegmentPackage | null> {
  try {
    return segmentPackageSchema.parse(
      JSON.parse(await readFile(path.join(segmentsRoot, packagePath), 'utf8')),
    );
  } catch {
    return null;
  }
}

const selectedIdSet = new Set(selectedIds);
const candidateEntries =
  selectedIds.length === 0
    ? manifest.segments
    : manifest.segments.filter((entry) => selectedIdSet.has(entry.segmentId));
if (selectedIds.length > 0 && candidateEntries.length !== selectedIds.length) {
  throw new Error('One or more priority segment IDs are absent from the manifest');
}
const newOriginalIds: string[] = [];
for (const entry of candidateEntries) {
  const segment = await readSegment(entry.packagePath);
  if (
    segment !== null &&
    segment.production.generator !== 'emergency-recovery-alias' &&
    (selectedIds.length > 0 ||
      (newerThanMs !== null && Date.parse(segment.production.generatedAt) >= newerThanMs))
  ) {
    newOriginalIds.push(entry.segmentId);
  }
}
if (newOriginalIds.length === 0) {
  log({
    reordered: false,
    reason: 'no-new-originals',
    newerThan: newerThanValue ?? null,
    selectedIds,
  });
  process.exit(0);
}

let stdout = '';
let stderr = '';
try {
  const result = await execFileAsync(
    'ssh',
    [endorHost, 'docker', 'logs', '--since', '10m', '--tail', '20000', containerName],
    {
      timeout: 30_000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  stdout = result.stdout;
  stderr = result.stderr;
} catch (error) {
  log({
    reordered: false,
    reason: 'endor-log-read-failed',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(0);
}

let latestRequest: { segmentId: string; atMs: number } | null = null;
for (const line of `${stdout}\n${stderr}`.split(/[\r\n]+/u)) {
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
    // FFmpeg progress and Chromium diagnostics share the container log.
  }
}
if (latestRequest === null) {
  log({ reordered: false, reason: 'no-recent-live-segment', newOriginalIds });
  process.exit(0);
}

const currentEntry = manifest.segments.find((entry) => entry.segmentId === latestRequest.segmentId);
if (currentEntry === undefined) {
  log({
    reordered: false,
    reason: 'observed-segment-absent',
    observedSegmentId: latestRequest.segmentId,
    newOriginalIds,
  });
  process.exit(0);
}
if (Date.now() - latestRequest.atMs > currentEntry.durationMs + 20_000) {
  log({
    reordered: false,
    reason: 'observed-segment-stale',
    observedSegmentId: latestRequest.segmentId,
    newOriginalIds,
  });
  process.exit(0);
}

const result = prioritiseNewEntries(manifest, latestRequest.segmentId, newOriginalIds, lookahead);
if (result.reordered) {
  const nextPath = `${manifestPath}.${process.pid}.next`;
  await writeFile(
    nextPath,
    `${JSON.stringify(playoutManifestSchema.parse(result.manifest), null, 2)}\n`,
    'utf8',
  );
  await rename(nextPath, manifestPath);
}
log({
  reordered: result.reordered,
  observedSegmentId: latestRequest.segmentId,
  insertedAfterSegmentId: result.insertedAfterSegmentId,
  prioritisedSegmentIds: result.prioritisedSegmentIds,
  lookahead,
});
