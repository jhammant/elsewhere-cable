import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema, segmentPackageSchema } from '../../packages/schemas/src/index.js';
import {
  energiseVisualTimeline,
  remixedPacing,
} from '../../apps/generation-worker/src/visual-energiser.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requestedRecentCount(total: number): number {
  const raw = argument('recent');
  if (raw === undefined) {
    return total;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > total) {
    throw new Error(`--recent must be an integer from 1 to ${total}`);
  }
  return value;
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const apply = process.argv.includes('--apply');
const remixPacing = process.argv.includes('--remix-pacing');
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const afterSegmentId = argument('after');
const segmentIdsFile = argument('segment-ids-file');
const playedIdsFile = argument('played-ids');
const recentValue = argument('recent');
const selectionModes = [afterSegmentId, segmentIdsFile, playedIdsFile, recentValue].filter(
  (value) => value !== undefined,
).length;
if (selectionModes > 1) {
  throw new Error('--after, --segment-ids-file, --played-ids and --recent are mutually exclusive');
}
const afterIndex =
  afterSegmentId === undefined
    ? -1
    : manifest.segments.findIndex((entry) => entry.segmentId === afterSegmentId);
if (afterSegmentId !== undefined && afterIndex === -1) {
  throw new Error(`--after segment is absent from the manifest: ${afterSegmentId}`);
}
const requestedIds =
  segmentIdsFile === undefined
    ? null
    : new Set(
        (await readFile(path.resolve(workspaceRoot, segmentIdsFile), 'utf8'))
          .split(/\r?\n/u)
          .map((value) => value.trim())
          .filter((value) => /^seg_[a-z0-9_]+$/u.test(value)),
      );
const playedIds =
  playedIdsFile === undefined
    ? null
    : new Set(
        (await readFile(path.resolve(workspaceRoot, playedIdsFile), 'utf8'))
          .split(/\r?\n/u)
          .map((value) => value.trim())
          .filter((value) => /^seg_[a-z0-9_]+$/u.test(value)),
      );
const selectedEntries =
  afterIndex >= 0
    ? manifest.segments.slice(afterIndex + 1)
    : requestedIds !== null
      ? manifest.segments.filter((entry) => requestedIds.has(entry.segmentId))
      : playedIds !== null
        ? manifest.segments.filter((entry) => !playedIds.has(entry.segmentId))
        : manifest.segments.slice(
            manifest.segments.length - requestedRecentCount(manifest.segments.length),
          );
const selectedIds = new Set(selectedEntries.map((entry) => entry.segmentId));

let changedSegmentCount = 0;
let cameraEventsAdded = 0;
let graphicEventsAdded = 0;
let staticEventsAdded = 0;
let repairedGraphics = 0;
let pacingChanges = 0;
let selectedIndex = 0;
for (const entry of manifest.segments) {
  if (!selectedIds.has(entry.segmentId)) {
    continue;
  }
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
  const result = energiseVisualTimeline(segment, {
    ...(remixPacing ? { pacing: remixedPacing(selectedIndex) } : {}),
    repairGraphics: true,
  });
  selectedIndex += 1;
  if (
    result.cameraEventsAdded === 0 &&
    result.graphicEventsAdded === 0 &&
    result.staticEventsAdded === 0 &&
    result.repairedGraphics === 0 &&
    !result.pacingChanged
  ) {
    continue;
  }
  changedSegmentCount += 1;
  cameraEventsAdded += result.cameraEventsAdded;
  graphicEventsAdded += result.graphicEventsAdded;
  staticEventsAdded += result.staticEventsAdded;
  repairedGraphics += result.repairedGraphics;
  pacingChanges += Number(result.pacingChanged);
  if (apply) {
    const nextPath = `${segmentPath}.${process.pid}.next`;
    await writeFile(nextPath, `${JSON.stringify(result.segment, null, 2)}\n`, 'utf8');
    await rename(nextPath, segmentPath);
  }
}

if (apply && changedSegmentCount > 0) {
  const revisedManifest = playoutManifestSchema.parse({
    ...manifest,
    generatedAt: new Date().toISOString(),
  });
  const nextManifestPath = `${manifestPath}.${process.pid}.next`;
  await writeFile(nextManifestPath, `${JSON.stringify(revisedManifest, null, 2)}\n`, 'utf8');
  await rename(nextManifestPath, manifestPath);
}

process.stdout.write(
  `${JSON.stringify({
    applied: apply,
    selectedSegmentCount: selectedEntries.length,
    changedSegmentCount,
    cameraEventsAdded,
    graphicEventsAdded,
    staticEventsAdded,
    repairedGraphics,
    pacingChanges,
    segmentCount: manifest.segments.length,
  })}\n`,
);
