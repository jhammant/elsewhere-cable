import { access, cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema, type PlayoutManifest } from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function readManifest(root: string): Promise<PlayoutManifest> {
  try {
    return playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 0,
        segments: [],
      };
    }
    throw error;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const baseRoot = path.resolve(workspaceRoot, argument('base') ?? 'data/segments');
const outputRoot = path.resolve(workspaceRoot, argument('output') ?? 'data/segments-live');
const baseManifest = await readManifest(baseRoot);
const liveManifest = await readManifest(outputRoot);

await mkdir(outputRoot, { recursive: true });
for (const entry of baseManifest.segments) {
  const packageDirectory = entry.packagePath.split('/')[0];
  if (packageDirectory === undefined || !/^seg_[a-z0-9_]+$/u.test(packageDirectory)) {
    throw new Error(`Unsafe base package path: ${entry.packagePath}`);
  }
  const source = path.join(baseRoot, packageDirectory);
  const destination = path.join(outputRoot, packageDirectory);
  if (!(await exists(destination))) {
    await cp(source, destination, { recursive: true, errorOnExist: true });
  }
}

const entriesById = new Map(
  [...baseManifest.segments, ...liveManifest.segments].map((entry) => [entry.segmentId, entry]),
);
const segments = [...entriesById.values()];
for (const entry of segments) {
  await access(path.join(outputRoot, entry.packagePath));
}

const combinedManifest = playoutManifestSchema.parse({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  totalDurationMs: segments.reduce((total, entry) => total + entry.durationMs, 0),
  segments,
});
const nextManifest = path.join(outputRoot, 'manifest.json.next');
await writeFile(nextManifest, `${JSON.stringify(combinedManifest, null, 2)}\n`, 'utf8');
await rename(nextManifest, path.join(outputRoot, 'manifest.json'));

process.stdout.write(
  `${JSON.stringify(
    {
      baseSegmentCount: baseManifest.segments.length,
      liveSegmentCount: liveManifest.segments.length,
      combinedSegmentCount: combinedManifest.segments.length,
      durationMs: combinedManifest.totalDurationMs,
      outputRoot,
    },
    null,
    2,
  )}\n`,
);
