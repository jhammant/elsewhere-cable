import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema, segmentPackageSchema } from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(
  workspaceRoot,
  argument('segments') ?? process.env.ELSEWHERE_LIVE_SEGMENTS_DIR ?? 'data/segments-live',
);
const outputPath = path.resolve(
  workspaceRoot,
  argument('output') ?? 'data/runtime/curated-live-manifest.json',
);
const allowedGenerators = new Set(
  (argument('generators') ??
    'demo-library,curated-launch-pack,signal-surf-editorial-pack,endor-compatibility-repair')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

if (allowedGenerators.size === 0) {
  throw new Error('At least one generator must be allowed');
}

const manifest = playoutManifestSchema.parse(
  JSON.parse(await readFile(path.join(segmentsRoot, 'manifest.json'), 'utf8')),
);
const selected: typeof manifest.segments = [];
const generatorCounts = new Map<string, number>();

for (const entry of manifest.segments) {
  const segmentPath = path.join(segmentsRoot, entry.packagePath);
  const segment = segmentPackageSchema.parse(JSON.parse(await readFile(segmentPath, 'utf8')));
  if (!allowedGenerators.has(segment.production.generator)) {
    continue;
  }
  selected.push(entry);
  generatorCounts.set(
    segment.production.generator,
    (generatorCounts.get(segment.production.generator) ?? 0) + 1,
  );
}

if (selected.length === 0) {
  throw new Error('The curated manifest would be empty');
}

const curated = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  totalDurationMs: selected.reduce((total, entry) => total + entry.durationMs, 0),
  segments: selected,
});
const nextPath = `${outputPath}.${process.pid}.next`;
await writeFile(nextPath, `${JSON.stringify(curated, null, 2)}\n`, 'utf8');
await rename(nextPath, outputPath);

process.stdout.write(
  `${JSON.stringify(
    {
      outputPath,
      segmentCount: curated.segments.length,
      durationHours: Number((curated.totalDurationMs / 3_600_000).toFixed(3)),
      generators: Object.fromEntries([...generatorCounts].sort(([left], [right]) => left.localeCompare(right))),
    },
    null,
    2,
  )}\n`,
);
