import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const segmentPrefix = argument('segment-prefix');
const expectedCount = Number(argument('expected-count'));
if (segmentPrefix === undefined || !/^seg_[a-z0-9_]+$/u.test(segmentPrefix)) {
  throw new Error('--segment-prefix must be a safe segment ID prefix');
}
if (!Number.isInteger(expectedCount) || expectedCount < 1) {
  throw new Error('--expected-count must be a positive integer');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const withdrawn = manifest.segments.filter(({ segmentId }) =>
  segmentId.startsWith(segmentPrefix),
);
if (withdrawn.length !== expectedCount) {
  throw new Error(
    `Expected ${expectedCount} matching segments, found ${withdrawn.length}; manifest unchanged`,
  );
}
const retained = manifest.segments.filter(
  ({ segmentId }) => !segmentId.startsWith(segmentPrefix),
);
const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  segments: retained,
  totalDurationMs: retained.reduce((total, entry) => total + entry.durationMs, 0),
});
const nextPath = `${manifestPath}.${process.pid}.next`;
await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
await rename(nextPath, manifestPath);

process.stdout.write(
  `${JSON.stringify(
    {
      withdrawnSegmentCount: withdrawn.length,
      withdrawnSegmentIds: withdrawn.map(({ segmentId }) => segmentId),
      retainedSegmentCount: retained.length,
      packagesPreservedForRecovery: true,
    },
    null,
    2,
  )}\n`,
);
