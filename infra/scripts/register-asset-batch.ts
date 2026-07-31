import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assetLibraryEntrySchema,
  assetLibraryManifestSchema,
  type AssetLibraryEntry,
} from '../../packages/schemas/src/index.js';
import { readArg } from './lib/args.js';

interface AssetBatch {
  generatedAt: string;
  assets: unknown[];
}

const workspaceRoot = process.cwd();
const catalogPath = path.join(workspaceRoot, 'apps/renderer/public/assets/library/catalog.json');

function parseBatch(value: unknown): AssetBatch {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Asset batch must be a JSON object');
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.generatedAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.generatedAt)) ||
    !Array.isArray(candidate.assets) ||
    candidate.assets.length === 0
  ) {
    throw new Error('Asset batch requires generatedAt and a non-empty assets array');
  }
  return {
    generatedAt: candidate.generatedAt,
    assets: candidate.assets,
  };
}

function pngDimensions(content: Buffer): { width: number; height: number } {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (content.length < 24 || !content.subarray(0, 8).equals(pngSignature)) {
    throw new Error('Only validated PNG assets are supported by this intake command');
  }
  return {
    width: content.readUInt32BE(16),
    height: content.readUInt32BE(20),
  };
}

async function hydrateEntry(value: unknown): Promise<AssetLibraryEntry> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Asset entry must be a JSON object');
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.uri !== 'string' || !candidate.uri.startsWith('/assets/')) {
    throw new Error('Batch assets must use local /assets/ URIs');
  }
  const assetPath = path.join(
    workspaceRoot,
    'apps/renderer/public',
    candidate.uri.replace(/^\//u, ''),
  );
  const content = await readFile(assetPath);
  return assetLibraryEntrySchema.parse({
    ...candidate,
    mimeType: 'image/png',
    sha256: createHash('sha256').update(content).digest('hex'),
    bytes: content.byteLength,
    dimensions: pngDimensions(content),
  });
}

const batchArgument = readArg('batch');
if (batchArgument === undefined) {
  throw new Error('Usage: pnpm assets:register -- --batch <batch.json>');
}

const batchPath = path.resolve(workspaceRoot, batchArgument);
const [manifest, batch] = await Promise.all([
  readFile(catalogPath, 'utf8').then((content) =>
    assetLibraryManifestSchema.parse(JSON.parse(content)),
  ),
  readFile(batchPath, 'utf8').then((content) => parseBatch(JSON.parse(content))),
]);
const entries = await Promise.all(batch.assets.map((entry) => hydrateEntry(entry)));
const existingIds = new Set(manifest.assets.map((asset) => asset.id));
const existingUris = new Set(manifest.assets.map((asset) => asset.uri));
const existingHashes = new Map(
  manifest.assets
    .filter((asset) => asset.sha256 !== undefined)
    .map((asset) => [asset.sha256!, asset.id]),
);
const batchIds = new Set<string>();
const batchUris = new Set<string>();
const batchHashes = new Map<string, string>();

for (const entry of entries) {
  if (existingIds.has(entry.id) || batchIds.has(entry.id)) {
    throw new Error(`Duplicate asset ID: ${entry.id}`);
  }
  if (existingUris.has(entry.uri) || batchUris.has(entry.uri)) {
    throw new Error(`Duplicate asset URI: ${entry.uri}`);
  }
  if (entry.sha256 !== undefined) {
    const matchingId = existingHashes.get(entry.sha256) ?? batchHashes.get(entry.sha256);
    if (matchingId !== undefined) {
      throw new Error(`Asset ${entry.id} duplicates content from ${matchingId}`);
    }
    batchHashes.set(entry.sha256, entry.id);
  }
  batchIds.add(entry.id);
  batchUris.add(entry.uri);
}

const nextManifest = assetLibraryManifestSchema.parse({
  ...manifest,
  generatedAt: batch.generatedAt,
  assets: [...manifest.assets, ...entries],
});
const temporaryPath = `${catalogPath}.${process.pid}.${randomUUID()}.next`;
try {
  await writeFile(temporaryPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, catalogPath);
} catch (error) {
  await unlink(temporaryPath).catch(() => undefined);
  throw error;
}

process.stdout.write(
  `${JSON.stringify(
    {
      registered: entries.length,
      totalAssets: nextManifest.assets.length,
      generatedAt: nextManifest.generatedAt,
      assetIds: entries.map((entry) => entry.id),
    },
    null,
    2,
  )}\n`,
);
