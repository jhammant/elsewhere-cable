import { mkdir, readFile, realpath, rename, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
  type SegmentPackage,
} from '../../packages/schemas/src/index.js';
import { containsSpokenStageDirection } from '../../apps/generation-worker/src/dialogue-quality.js';
import {
  inspectSpeechAudio,
  maximumPlausibleSpeechDurationMs,
  speechAudioQualityIssue,
} from '../../apps/generation-worker/src/providers.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const count = Number(argument('count') ?? 32);
if (!Number.isInteger(count) || count < 1 || count > 100) {
  throw new Error('--count must be an integer from 1 to 100');
}
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));

const candidates: Array<{
  entry: PlayoutManifest['segments'][number];
  segment: SegmentPackage;
}> = [];
const audioQualityCache = new Map<string, Promise<string | null>>();

async function audioQualityIssue(audioPath: string): Promise<string | null> {
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
  try {
    const segmentPath = path.join(segmentsRoot, entry.packagePath);
    const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
    if (segment.production.generator !== 'emergency-recovery-alias') {
      candidates.push({ entry, segment });
    }
  } catch {
    // Only complete, approved packages can become recovery material.
  }
}
const demoCandidates = candidates.filter(
  ({ segment }) => segment.production.generator === 'demo-library',
);
const candidateSourcePool = demoCandidates.length >= count ? demoCandidates : candidates;
if (candidateSourcePool.length === 0) {
  throw new Error('No approved package is available for emergency refill');
}
const desiredSourceCount = Math.min(candidateSourcePool.length, Math.max(8, Math.min(count, 32)));
const sourcePool: typeof candidates = [];
for (const source of candidateSourcePool) {
  const segmentPath = path.join(segmentsRoot, source.entry.packagePath);
  let eligible = true;
  for (const event of source.segment.events) {
    if (event.type !== 'speech.play') {
      continue;
    }
    if (
      containsSpokenStageDirection(event.subtitle) ||
      event.durationMs > maximumPlausibleSpeechDurationMs(event.subtitle) ||
      (await audioQualityIssue(path.join(path.dirname(segmentPath), event.audioFile))) !== null
    ) {
      eligible = false;
      break;
    }
  }
  if (eligible) {
    sourcePool.push(source);
  }
  if (sourcePool.length >= desiredSourceCount) {
    break;
  }
}
if (sourcePool.length === 0) {
  throw new Error('No audio-safe package is available for emergency refill');
}

const stamp = Date.now().toString(36);
const recoveryEntries: PlayoutManifest['segments'] = [];
for (let index = 0; index < count; index += 1) {
  const sourceIndex = Math.floor((index * sourcePool.length) / count);
  const source = sourcePool[sourceIndex] ?? sourcePool[index % sourcePool.length]!;
  const aliasId = `seg_recovery_${stamp}_${String(index).padStart(3, '0')}`;
  const sourceDirectory = path.join(segmentsRoot, source.entry.packagePath.split('/')[0]!);
  const aliasDirectory = path.join(segmentsRoot, aliasId);
  await mkdir(aliasDirectory, { recursive: false });
  await symlink(
    path.relative(aliasDirectory, path.join(sourceDirectory, 'audio')),
    path.join(aliasDirectory, 'audio'),
    'dir',
  );
  const segment = segmentPackageSchema.parse({
    ...source.segment,
    segmentId: aliasId,
    production: {
      ...source.segment.production,
      generatedAt: new Date().toISOString(),
      generator: 'emergency-recovery-alias',
      model: 'approved-replay',
    },
  });
  await writeFile(
    path.join(aliasDirectory, 'segment.json'),
    `${JSON.stringify(segment, null, 2)}\n`,
    'utf8',
  );
  recoveryEntries.push({
    ...source.entry,
    segmentId: aliasId,
    packagePath: `${aliasId}/segment.json`,
  });
}

const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  segments: [...manifest.segments, ...recoveryEntries],
  totalDurationMs:
    manifest.totalDurationMs +
    recoveryEntries.reduce((total, entry) => total + entry.durationMs, 0),
});
const nextManifestPath = `${manifestPath}.next`;
await writeFile(nextManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
await rename(nextManifestPath, manifestPath);

process.stdout.write(
  `${JSON.stringify(
    {
      recoverySegments: recoveryEntries.length,
      recoveryDurationMs: recoveryEntries.reduce((total, entry) => total + entry.durationMs, 0),
      source: demoCandidates.length >= count ? 'demo-library' : 'approved-catalogue',
      totalSegments: nextManifest.segments.length,
    },
    null,
    2,
  )}\n`,
);
