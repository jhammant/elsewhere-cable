import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema, segmentPackageSchema } from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const sourceSegmentId = argument('segment');
if (sourceSegmentId === undefined || !/^seg_[a-z0-9_]+$/u.test(sourceSegmentId)) {
  throw new Error('--segment must be a valid segment ID');
}
const visualMedium = argument('medium');
if (visualMedium === undefined) {
  throw new Error('--medium is required');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const manifest = playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const sourceEntry = manifest.segments.find((entry) => entry.segmentId === sourceSegmentId);
if (sourceEntry === undefined) {
  throw new Error(`Segment is absent from the manifest: ${sourceSegmentId}`);
}
const sourceDirectory = path.join(segmentsRoot, sourceEntry.packagePath.split('/')[0]!);
const sourceSegment = segmentPackageSchema.parse(
  JSON.parse(await readFile(path.join(sourceDirectory, 'segment.json'), 'utf8')),
);
const replacementId = `${sourceSegmentId}_compat_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const replacementDirectory = path.join(segmentsRoot, replacementId);
await mkdir(replacementDirectory);
await symlink(
  path.relative(replacementDirectory, path.join(sourceDirectory, 'audio')),
  path.join(replacementDirectory, 'audio'),
  'dir',
);
const replacementSegment = segmentPackageSchema.parse({
  ...sourceSegment,
  segmentId: replacementId,
  visualMedium,
  visualStyle: `${sourceSegment.visualStyle}_endor_compatible`.slice(0, 80),
  production: {
    ...sourceSegment.production,
    generatedAt: new Date().toISOString(),
    generator: 'endor-compatibility-repair',
  },
});
await writeFile(
  path.join(replacementDirectory, 'segment.json'),
  `${JSON.stringify(replacementSegment, null, 2)}\n`,
  'utf8',
);

const replacementEntry = {
  ...sourceEntry,
  segmentId: replacementId,
  packagePath: `${replacementId}/segment.json`,
};
const nextManifest = playoutManifestSchema.parse({
  ...manifest,
  generatedAt: new Date().toISOString(),
  segments: [
    ...manifest.segments.filter((entry) => entry.segmentId !== sourceSegmentId),
    replacementEntry,
  ],
});
const nextPath = `${manifestPath}.${process.pid}.next`;
await writeFile(nextPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
await rename(nextPath, manifestPath);

process.stdout.write(
  `${JSON.stringify({
    removedSegmentId: sourceSegmentId,
    replacementSegmentId: replacementId,
    visualMedium,
    totalSegmentCount: nextManifest.segments.length,
  })}\n`,
);
