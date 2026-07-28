import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
} from '../../packages/schemas/src/index.js';
import { maximumPlausibleSpeechDurationMs } from '../../apps/generation-worker/src/providers.js';

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
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const accepted: PlayoutManifest['segments'] = [];
const rejected: Array<{ segmentId: string; reasons: string[] }> = [];

for (const entry of manifest.segments) {
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const reasons: string[] = [];
  try {
    const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
    for (const event of segment.events) {
      if (event.type !== 'speech.play') {
        continue;
      }
      const ceiling = maximumPlausibleSpeechDurationMs(event.subtitle);
      if (event.durationMs > ceiling) {
        reasons.push(
          `${event.speechId} is ${event.durationMs}ms; maximum plausible duration is ${ceiling}ms`,
        );
      }
      const audioPath = path.join(path.dirname(segmentPath), event.audioFile);
      try {
        await readFile(audioPath);
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
      rejected,
      segmentsRoot,
    },
    null,
    2,
  )}\n`,
);

if (!apply && rejected.length > 0) {
  process.exitCode = 1;
}
