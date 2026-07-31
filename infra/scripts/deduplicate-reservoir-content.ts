import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
} from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function normalise(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-GB')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function contentKey(segment: ReturnType<typeof segmentPackageSchema.parse>): string {
  return `${normalise(segment.programme.title)}\n${normalise(segment.programme.premise)}`;
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const apply = process.argv.includes('--apply');
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const seenContent = new Set<string>();
const uniqueEntries: PlayoutManifest['segments'] = [];
const removedEntries: PlayoutManifest['segments'] = [];
let unreadableEntries = 0;

for (const entry of manifest.segments) {
  try {
    const segment = segmentPackageSchema.parse(
      JSON.parse(await readFile(path.join(segmentsRoot, entry.packagePath), 'utf8')),
    );
    const key = contentKey(segment);
    if (seenContent.has(key)) {
      removedEntries.push(entry);
      continue;
    }
    seenContent.add(key);
    uniqueEntries.push(entry);
  } catch {
    unreadableEntries += 1;
    uniqueEntries.push(entry);
  }
}

const uniqueDurationMs = uniqueEntries.reduce((total, entry) => total + entry.durationMs, 0);
const report = {
  apply,
  originalSegmentCount: manifest.segments.length,
  uniqueSegmentCount: uniqueEntries.length,
  removedAliasCount: removedEntries.length,
  unreadableEntries,
  originalHours: Number((manifest.totalDurationMs / 3_600_000).toFixed(2)),
  uniqueHours: Number((uniqueDurationMs / 3_600_000).toFixed(2)),
};

if (apply && removedEntries.length > 0) {
  const nextManifest = playoutManifestSchema.parse({
    ...manifest,
    generatedAt: new Date().toISOString(),
    totalDurationMs: uniqueDurationMs,
    segments: uniqueEntries,
  });
  const nextPath = `${manifestPath}.${process.pid}.next`;
  try {
    await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    await rename(nextPath, manifestPath);
  } finally {
    await rm(nextPath, { force: true });
  }
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
