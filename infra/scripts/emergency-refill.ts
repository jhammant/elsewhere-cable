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
  minimumPlausibleSpeechDurationMs,
  speechAudioQualityIssue,
} from '../../apps/generation-worker/src/providers.js';
import { legacyPackageQualityIssues } from '../../apps/generation-worker/src/package-quality.js';
import {
  diversifyRunway,
  type RunwayDescriptor,
} from '../../apps/generation-worker/src/runway-diversity.js';
import { mixedRecoveryCatalogue } from '../../apps/generation-worker/src/recovery-catalogue.js';
import { energiseVisualTimeline } from '../../apps/generation-worker/src/visual-energiser.js';
import { compactRecoverySegment } from '../../apps/generation-worker/src/timeline-recovery.js';
import { currentEndorTarget, currentEndorVisualMedia } from './endor-compatibility.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const count = Number(argument('count') ?? 32);
const compatibilityTarget = argument('target');
if (compatibilityTarget !== undefined && compatibilityTarget !== currentEndorTarget) {
  throw new Error(`Unsupported recovery compatibility target: ${compatibilityTarget}`);
}
if (!Number.isInteger(count) || count < 1 || count > 100) {
  throw new Error('--count must be an integer from 1 to 100');
}
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const sourceIdsPath = argument('source-ids-file');
const sourceIdsValue = argument('source-ids');
if (sourceIdsPath !== undefined && sourceIdsValue !== undefined) {
  throw new Error('--source-ids and --source-ids-file are mutually exclusive');
}
const requestedSourceIds =
  sourceIdsPath !== undefined
    ? new Set(
        (await readFile(path.resolve(workspaceRoot, sourceIdsPath), 'utf8'))
          .split(/\r?\n/u)
          .map((value) => value.trim())
          .filter((value) => /^seg_[a-z0-9_]+$/u.test(value)),
      )
    : sourceIdsValue !== undefined
      ? new Set(
          sourceIdsValue
            .split(',')
            .map((value) => value.trim())
            .filter((value) => /^seg_[a-z0-9_]+$/u.test(value)),
        )
      : null;

const candidates: Array<{
  entry: PlayoutManifest['segments'][number];
  segment: SegmentPackage;
}> = [];
let existingRecoverySegments = 0;
const manifestProgrammeIds: string[] = [];
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
    manifestProgrammeIds.push(segment.programme.id);
    if (segment.production.generator !== 'emergency-recovery-alias') {
      candidates.push({ entry, segment });
    } else {
      existingRecoverySegments += 1;
    }
  } catch {
    // Only complete, approved packages can become recovery material.
  }
}
const compatibleCandidates =
  compatibilityTarget === currentEndorTarget
    ? candidates.filter(({ segment }) =>
        currentEndorVisualMedia.has(segment.visualMedium ?? 'legacy'),
      )
    : candidates;
const demoCandidates = compatibleCandidates.filter(
  ({ segment }) => segment.production.generator === 'demo-library',
);
const approvedOriginalCandidates = compatibleCandidates.filter(
  ({ segment }) => segment.production.generator !== 'demo-library',
);
const requestedCandidates =
  requestedSourceIds === null
    ? []
    : compatibleCandidates.filter(({ entry }) => requestedSourceIds.has(entry.segmentId));
const mixedCandidateSourcePool = mixedRecoveryCatalogue(
  approvedOriginalCandidates,
  demoCandidates,
  existingRecoverySegments,
);
const recentlyUsedProgrammeIds = new Set(
  manifestProgrammeIds.slice(-compatibleCandidates.length),
);
const unseenCandidateSourcePool = mixedCandidateSourcePool.filter(
  ({ segment }) => !recentlyUsedProgrammeIds.has(segment.programme.id),
);
const recentlyUsedSourcesExcluded =
  requestedSourceIds === null && unseenCandidateSourcePool.length >= count;
const candidateSourcePool =
  requestedSourceIds !== null
    ? requestedCandidates
    : recentlyUsedSourcesExcluded
      ? unseenCandidateSourcePool
      : mixedCandidateSourcePool;
if (candidateSourcePool.length === 0) {
  throw new Error('No approved package is available for emergency refill');
}
const desiredSourceCount = Math.min(candidateSourcePool.length, count * 4);
const sourcePool: typeof candidates = [];
for (const source of candidateSourcePool) {
  const segmentPath = path.join(segmentsRoot, source.entry.packagePath);
  let eligible = legacyPackageQualityIssues(source.segment).length === 0;
  for (const event of source.segment.events) {
    if (event.type !== 'speech.play') {
      continue;
    }
    if (
      containsSpokenStageDirection(event.subtitle) ||
      event.durationMs < minimumPlausibleSpeechDurationMs(event.subtitle, 1.5) ||
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

type RecoverySource = (typeof sourcePool)[number] & RunwayDescriptor;
function recoveryDescriptor(source: (typeof sourcePool)[number]): RecoverySource {
  return {
    ...source,
    segmentId: source.segment.segmentId,
    channelId: source.segment.channel.id,
    programmeId: source.segment.programme.id,
    format: source.segment.programme.format,
    visualMedium: source.segment.visualMedium ?? 'legacy',
    castArchetype: source.segment.castArchetype ?? 'legacy',
    pacing: source.segment.pacing ?? 'conversational',
    storyMode: source.segment.storyMode ?? 'legacy',
  };
}

const precedingSource = candidates.at(-1);
const preceding = precedingSource === undefined ? null : recoveryDescriptor(precedingSource);
const diversifiedSourcePool = diversifyRunway(
  sourcePool.map((source) => recoveryDescriptor(source)),
  preceding,
).slice(0, count);
const stamp = Date.now().toString(36);
const recoveryEntries: PlayoutManifest['segments'] = [];
let cameraEventsAdded = 0;
let graphicEventsAdded = 0;
let timelineDurationRemovedMs = 0;
let speechGapsTightened = 0;
let leadDurationRemovedMs = 0;
let tailDurationRemovedMs = 0;
const recoveryPresentationPacing = [
  'frantic',
  'staccato',
  'interrupted',
  'conversational',
] as const;
for (let index = 0; index < count; index += 1) {
  const sourceIndex = Math.floor((index * diversifiedSourcePool.length) / count);
  const source =
    diversifiedSourcePool[sourceIndex] ??
    diversifiedSourcePool[index % diversifiedSourcePool.length]!;
  const aliasId = `seg_recovery_${stamp}_${String(index).padStart(3, '0')}`;
  const sourceDirectory = path.join(segmentsRoot, source.entry.packagePath.split('/')[0]!);
  const aliasDirectory = path.join(segmentsRoot, aliasId);
  await mkdir(aliasDirectory, { recursive: false });
  await symlink(
    path.relative(aliasDirectory, path.join(sourceDirectory, 'audio')),
    path.join(aliasDirectory, 'audio'),
    'dir',
  );
  const aliasBase = segmentPackageSchema.parse({
    ...source.segment,
    segmentId: aliasId,
    production: {
      ...source.segment.production,
      generatedAt: new Date().toISOString(),
      generator: 'emergency-recovery-alias',
      model: 'approved-replay',
    },
  });
  const presentationPacing =
    recoveryPresentationPacing[
      (existingRecoverySegments + index) % recoveryPresentationPacing.length
    ]!;
  const compacted = compactRecoverySegment(aliasBase, presentationPacing);
  timelineDurationRemovedMs += compacted.timelineDurationRemovedMs;
  speechGapsTightened += compacted.speechGapsTightened;
  leadDurationRemovedMs += compacted.leadDurationRemovedMs;
  tailDurationRemovedMs += compacted.tailDurationRemovedMs;
  const energised = energiseVisualTimeline(compacted.segment, {
    pacing: presentationPacing,
    repairGraphics: true,
    addStatic: false,
  });
  cameraEventsAdded += energised.cameraEventsAdded;
  graphicEventsAdded += energised.graphicEventsAdded;
  const segment = segmentPackageSchema.parse(energised.segment);
  await writeFile(
    path.join(aliasDirectory, 'segment.json'),
    `${JSON.stringify(segment, null, 2)}\n`,
    'utf8',
  );
  recoveryEntries.push({
    ...source.entry,
    segmentId: aliasId,
    packagePath: `${aliasId}/segment.json`,
    durationMs: segment.durationMs,
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
      distinctSources: diversifiedSourcePool.length,
      candidateSourcesEvaluated: sourcePool.length,
      diversified: true,
      cameraEventsAdded,
      graphicEventsAdded,
      audioStaticAdded: 0,
      timelineDurationRemovedMs,
      speechGapsTightened,
      leadDurationRemovedMs,
      tailDurationRemovedMs,
      source:
        requestedSourceIds !== null ? 'requested-approved-catalogue' : 'mixed-approved-catalogue',
      recentlyUsedSourcesExcluded,
      compatibilityTarget: compatibilityTarget ?? null,
      totalSegments: nextManifest.segments.length,
    },
    null,
    2,
  )}\n`,
);
