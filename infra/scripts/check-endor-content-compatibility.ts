import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';
import { currentEndorTarget, currentEndorVisualMedia } from './endor-compatibility.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const manifest = playoutManifestSchema.parse(
  JSON.parse(await readFile(path.join(segmentsRoot, 'manifest.json'), 'utf8')),
);
const incompatible: Array<{ segmentId: string; visualMedium: string }> = [];
for (const entry of manifest.segments) {
  const raw = JSON.parse(await readFile(path.join(segmentsRoot, entry.packagePath), 'utf8')) as {
    visualMedium?: unknown;
  };
  if (typeof raw.visualMedium === 'string' && !currentEndorVisualMedia.has(raw.visualMedium)) {
    incompatible.push({
      segmentId: entry.segmentId,
      visualMedium: raw.visualMedium,
    });
  }
}

if (incompatible.length > 0) {
  process.stderr.write(
    `${JSON.stringify({
      compatible: false,
      target: currentEndorTarget,
      incompatible: incompatible.slice(0, 20),
      incompatibleCount: incompatible.length,
    })}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify({
      compatible: true,
      target: currentEndorTarget,
      segmentCount: manifest.segments.length,
    })}\n`,
  );
}
