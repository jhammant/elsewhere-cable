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
const publishedCount = Number(argument('published-count'));
const expectedTailPrefix = argument('expected-tail-prefix');
if (!Number.isInteger(publishedCount) || publishedCount < 1) {
  throw new Error('--published-count must be a positive integer');
}
if (expectedTailPrefix === undefined || !/^seg_[a-z0-9_]+$/u.test(expectedTailPrefix)) {
  throw new Error('--expected-tail-prefix must be a safe segment ID prefix');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const withdrawn = manifest.segments.slice(publishedCount);
if (withdrawn.length === 0) {
  throw new Error('No unpublished manifest tail exists at the requested boundary');
}
const unexpected = withdrawn.filter(
  ({ segmentId }) => !segmentId.startsWith(expectedTailPrefix),
);
if (unexpected.length > 0) {
  throw new Error(
    `Refusing to withdraw a mixed tail; unexpected IDs: ${unexpected
      .slice(0, 5)
      .map(({ segmentId }) => segmentId)
      .join(', ')}`,
  );
}

const retained = manifest.segments.slice(0, publishedCount);
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
