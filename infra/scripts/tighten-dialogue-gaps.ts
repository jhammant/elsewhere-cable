import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
  type SegmentEvent,
} from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function recentCount(total: number): number {
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

interface Shift {
  boundaryMs: number;
  reductionMs: number;
}

function shiftedTime(atMs: number, shifts: readonly Shift[]): number {
  return (
    atMs -
    shifts.reduce((total, shift) => total + (atMs >= shift.boundaryMs ? shift.reductionMs : 0), 0)
  );
}

function dialogueShifts(events: readonly SegmentEvent[], targetGapMs: number): Shift[] {
  const speech = events
    .filter(
      (event): event is Extract<SegmentEvent, { type: 'speech.play' }> =>
        event.type === 'speech.play',
    )
    .sort((left, right) => left.atMs - right.atMs);
  const shifts: Shift[] = [];
  for (let index = 1; index < speech.length; index += 1) {
    const previous = speech[index - 1]!;
    const current = speech[index]!;
    const previousEndMs = previous.atMs + previous.durationMs;
    const gapMs = current.atMs - previousEndMs;
    if (gapMs <= targetGapMs) {
      continue;
    }
    shifts.push({
      boundaryMs: Math.max(previousEndMs + 180, current.atMs - 200),
      reductionMs: gapMs - targetGapMs,
    });
  }
  return shifts;
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const selectedCount = recentCount(manifest.segments.length);
const selectedIds = new Set(
  manifest.segments.slice(manifest.segments.length - selectedCount).map((entry) => entry.segmentId),
);
const apply = process.argv.includes('--apply');
const nextEntries: PlayoutManifest['segments'] = [];
let changedSegmentCount = 0;
let removedDurationMs = 0;
let tightenedGapCount = 0;

for (const entry of manifest.segments) {
  if (!selectedIds.has(entry.segmentId)) {
    nextEntries.push(entry);
    continue;
  }
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
  const pacing = segment.pacing ?? 'conversational';
  const targetGapMs = pacing === 'conversational' ? 420 : pacing === 'interrupted' ? 360 : null;
  if (targetGapMs === null) {
    nextEntries.push(entry);
    continue;
  }
  const shifts = dialogueShifts(segment.events, targetGapMs);
  if (shifts.length === 0) {
    nextEntries.push(entry);
    continue;
  }
  const totalReductionMs = shifts.reduce((total, shift) => total + shift.reductionMs, 0);
  const nextDurationMs = segment.durationMs - totalReductionMs;
  const nextSegment = segmentPackageSchema.parse({
    ...segment,
    durationMs: nextDurationMs,
    events: segment.events
      .map((event) => ({ ...event, atMs: shiftedTime(event.atMs, shifts) }))
      .sort((left, right) => left.atMs - right.atMs),
    suggestedExit: {
      ...segment.suggestedExit,
      earliestMs: Math.max(0, segment.suggestedExit.earliestMs - totalReductionMs),
      preferredMs: Math.max(0, segment.suggestedExit.preferredMs - totalReductionMs),
    },
  });
  if (apply) {
    const nextPath = `${segmentPath}.${process.pid}.next`;
    await writeFile(nextPath, `${JSON.stringify(nextSegment, null, 2)}\n`, 'utf8');
    await rename(nextPath, segmentPath);
  }
  changedSegmentCount += 1;
  tightenedGapCount += shifts.length;
  removedDurationMs += totalReductionMs;
  nextEntries.push({ ...entry, durationMs: nextDurationMs });
}

const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  totalDurationMs: nextEntries.reduce((total, entry) => total + entry.durationMs, 0),
  segments: nextEntries,
});
if (apply && changedSegmentCount > 0) {
  const nextPath = `${manifestPath}.${process.pid}.next`;
  await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  await rename(nextPath, manifestPath);
}

process.stdout.write(
  `${JSON.stringify({
    applied: apply,
    selectedSegmentCount: selectedCount,
    changedSegmentCount,
    tightenedGapCount,
    removedDurationMs,
    nextDurationMs: nextManifest.totalDurationMs,
  })}\n`,
);
