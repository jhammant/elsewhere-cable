import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { playoutManifestSchema } from '../../packages/schemas/src/index.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const legacyEndorMedia = new Set([
  'cel_shaded',
  'paper_cutout',
  'pixel_broadcast',
  'archive_film',
  'neon_wireframe',
  'public_access_vhs',
  'signal_corruption',
  'stop_motion',
  'collage_zine',
  'ink_monochrome',
  'miniature_diorama',
  'corporate_vector',
  'claymation',
  'shadow_theatre',
  'hand_drawn',
  'thermal_camera',
]);

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
  if (typeof raw.visualMedium === 'string' && !legacyEndorMedia.has(raw.visualMedium)) {
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
      target: 'endor-running-b3c2ed1',
      incompatible: incompatible.slice(0, 20),
      incompatibleCount: incompatible.length,
    })}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify({
      compatible: true,
      target: 'endor-running-b3c2ed1',
      segmentCount: manifest.segments.length,
    })}\n`,
  );
}
