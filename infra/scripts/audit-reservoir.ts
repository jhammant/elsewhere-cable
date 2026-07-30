import { readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
} from '../../packages/schemas/src/index.js';
import {
  inspectSpeechAudio,
  maximumPlausibleSpeechDurationMs,
  minimumPlausibleSpeechDurationMs,
  speechAudioQualityIssue,
} from '../../apps/generation-worker/src/providers.js';
import { containsSpokenStageDirection } from '../../apps/generation-worker/src/dialogue-quality.js';
import { legacyPackageQualityIssues } from '../../apps/generation-worker/src/package-quality.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(
  workspaceRoot,
  argument('segments') ?? process.env.ELSEWHERE_LIVE_SEGMENTS_DIR ?? 'data/segments-live',
);
const apply = process.argv.includes('--apply');
const skipAudio = process.argv.includes('--skip-audio');
const summaryOnly = process.argv.includes('--summary-only');
const recentValue = argument('recent');
const segmentIdsValue = argument('segment-ids');
const playedIdsPath = argument('played-ids');
const requestedSegmentIds =
  segmentIdsValue === undefined
    ? null
    : new Set(
        segmentIdsValue
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      );
if (requestedSegmentIds !== null && requestedSegmentIds.size === 0) {
  throw new Error('--segment-ids must contain at least one segment ID');
}
const playedIds =
  playedIdsPath === undefined
    ? null
    : new Set(
        (await readFile(path.resolve(workspaceRoot, playedIdsPath), 'utf8'))
          .split(/\r?\n/gu)
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      );
if (playedIds !== null && playedIds.size === 0) {
  throw new Error('--played-ids must point to a non-empty newline-delimited ID file');
}
const recent =
  recentValue === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(recentValue, 10);
if (!(recent > 0)) {
  throw new Error('--recent must be a positive integer');
}
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const afterSegmentId = argument('after');
const countValue = argument('count');
if (
  requestedSegmentIds !== null &&
  (afterSegmentId !== undefined || countValue !== undefined || recentValue !== undefined)
) {
  throw new Error('--segment-ids is mutually exclusive with --after, --count and --recent');
}
if (
  playedIds !== null &&
  (requestedSegmentIds !== null ||
    afterSegmentId !== undefined ||
    countValue !== undefined ||
    recentValue !== undefined)
) {
  throw new Error('--played-ids is mutually exclusive with all other segment selection options');
}
const requestedCount =
  countValue === undefined ? manifest.segments.length - 1 : Number.parseInt(countValue, 10);
if (!Number.isInteger(requestedCount) || requestedCount < 1) {
  throw new Error('--count must be a positive integer');
}
const afterIndex =
  afterSegmentId === undefined
    ? -1
    : manifest.segments.findIndex((entry) => entry.segmentId === afterSegmentId);
if (afterSegmentId !== undefined && afterIndex === -1) {
  throw new Error(`--after segment is absent from the manifest: ${afterSegmentId}`);
}
if (requestedSegmentIds !== null) {
  const manifestIds = new Set(manifest.segments.map((entry) => entry.segmentId));
  const absentIds = [...requestedSegmentIds].filter((segmentId) => !manifestIds.has(segmentId));
  if (absentIds.length > 0) {
    throw new Error(`--segment-ids contains IDs absent from the manifest: ${absentIds.join(', ')}`);
  }
}
const auditedIds =
  requestedSegmentIds !== null
    ? requestedSegmentIds
    : playedIds !== null
      ? new Set(
          manifest.segments
            .filter((entry) => !playedIds.has(entry.segmentId))
            .map((entry) => entry.segmentId),
        )
      : afterIndex < 0
        ? new Set(
            manifest.segments
              .slice(Math.max(0, manifest.segments.length - recent))
              .map((entry) => entry.segmentId),
          )
        : new Set(
            Array.from(
              { length: Math.min(requestedCount, manifest.segments.length - 1) },
              (_, offset) =>
                manifest.segments[(afterIndex + 1 + offset) % manifest.segments.length]!.segmentId,
            ),
          );
const accepted: PlayoutManifest['segments'] = [];
const rejected: Array<{ segmentId: string; reasons: string[] }> = [];
const audioQualityCache = new Map<string, Promise<string | null>>();

async function cachedAudioQualityIssue(audioPath: string): Promise<string | null> {
  const canonicalPath = await realpath(audioPath);
  const cached = audioQualityCache.get(canonicalPath);
  if (cached !== undefined) {
    return cached;
  }
  const inspection = inspectSpeechAudio(canonicalPath).then((quality) =>
    speechAudioQualityIssue(quality),
  );
  audioQualityCache.set(canonicalPath, inspection);
  return inspection;
}

for (const entry of manifest.segments) {
  if (!auditedIds.has(entry.segmentId)) {
    accepted.push(entry);
    continue;
  }
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const reasons: string[] = [];
  try {
    const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
    reasons.push(...legacyPackageQualityIssues(segment));
    for (const event of segment.events) {
      if (event.type !== 'speech.play') {
        continue;
      }
      if (containsSpokenStageDirection(event.subtitle)) {
        reasons.push(`${event.speechId} contains a spoken stage direction`);
      }
      const ceiling = maximumPlausibleSpeechDurationMs(event.subtitle);
      // Packages do not retain the requested speaking-rate scalar. Audit with the fastest
      // supported rate so borderline energetic delivery is preserved while obvious clipping
      // still fails. Live synthesis uses the exact requested rate and is stricter.
      const floor = minimumPlausibleSpeechDurationMs(event.subtitle, 1.5);
      if (event.durationMs < floor) {
        reasons.push(
          `${event.speechId} is ${event.durationMs}ms; minimum plausible duration is ${floor}ms`,
        );
      }
      if (event.durationMs > ceiling) {
        reasons.push(
          `${event.speechId} is ${event.durationMs}ms; maximum plausible duration is ${ceiling}ms`,
        );
      }
      if (skipAudio) {
        continue;
      }
      const audioPath = path.join(path.dirname(segmentPath), event.audioFile);
      try {
        const qualityIssue = await cachedAudioQualityIssue(audioPath);
        if (qualityIssue !== null) {
          reasons.push(`${event.speechId} ${qualityIssue}`);
        }
      } catch {
        reasons.push(`${event.speechId} is missing its prepared audio file`);
      }
    }
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : String(error));
  }

  if (reasons.length === 0) {
    accepted.push(entry);
  } else {
    rejected.push({ segmentId: entry.segmentId, reasons });
  }
}

const cleanedManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  totalDurationMs: accepted.reduce((total, entry) => total + entry.durationMs, 0),
  segments: accepted,
});

if (apply && rejected.length > 0) {
  const nextManifestPath = `${manifestPath}.next`;
  await writeFile(nextManifestPath, `${JSON.stringify(cleanedManifest, null, 2)}\n`, 'utf8');
  await rename(nextManifestPath, manifestPath);
  await writeFile(
    path.join(segmentsRoot, 'quarantine.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rejected,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      applied: apply && rejected.length > 0,
      acceptedSegmentCount: accepted.length,
      rejectedSegmentCount: rejected.length,
      acceptedDurationMs: cleanedManifest.totalDurationMs,
      auditedSegmentCount: auditedIds.size,
      rejected: summaryOnly
        ? rejected.map(({ segmentId, reasons }) => ({
            segmentId,
            reasonCount: reasons.length,
          }))
        : rejected,
      skipAudio,
      segmentsRoot,
    },
    null,
    2,
  )}\n`,
);

if (!apply && rejected.length > 0) {
  process.exitCode = 1;
}
