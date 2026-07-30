import { execFile } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';

const execFileAsync = promisify(execFile);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const endorHost = argument('endor-host') ?? 'endor';
const expectedCount = Number(argument('expected-count'));
if (!Number.isInteger(expectedCount) || expectedCount < 1) {
  throw new Error('--expected-count must be a positive integer');
}

const manifestPath = path.join(segmentsRoot, 'manifest.json');
const localManifest = playoutManifestSchema.parse(
  JSON.parse(await readFile(manifestPath, 'utf8')),
);
const { stdout } = await execFileAsync(
  'ssh',
  [endorHost, 'curl', '-fsS', 'http://127.0.0.1:4174/api/playout/manifest'],
  { maxBuffer: 32 * 1024 * 1024 },
);
const endorManifest = playoutManifestSchema.parse(JSON.parse(stdout));
if (endorManifest.segments.length !== expectedCount) {
  throw new Error(
    `Endor manifest count ${endorManifest.segments.length} does not match expected ${expectedCount}`,
  );
}

const missingPackages: string[] = [];
for (const entry of endorManifest.segments) {
  try {
    await readFile(path.join(segmentsRoot, entry.packagePath), 'utf8');
  } catch {
    missingPackages.push(entry.segmentId);
  }
}
if (missingPackages.length > 0) {
  throw new Error(
    `Local reservoir is missing ${missingPackages.length} Endor packages: ${missingPackages
      .slice(0, 5)
      .join(', ')}`,
  );
}

const nextPath = `${manifestPath}.${process.pid}.next`;
await writeFile(nextPath, `${JSON.stringify(endorManifest, null, 2)}\n`, 'utf8');
await rename(nextPath, manifestPath);

process.stdout.write(
  `${JSON.stringify(
    {
      restoredSegmentCount: endorManifest.segments.length,
      replacedLocalSegmentCount: localManifest.segments.length,
      packagesPreservedForRecovery: true,
    },
    null,
    2,
  )}\n`,
);
