import { createHash } from 'node:crypto';
import { appendFile, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assetLibraryManifestSchema, type AssetKind } from '../../packages/schemas/src/index.js';

const workspaceRoot = process.cwd();
const catalogPath = path.join(workspaceRoot, 'apps/renderer/public/assets/library/catalog.json');
const outputPath = path.join(workspaceRoot, 'data/asset-library/status.json');
const historyPath = path.join(workspaceRoot, 'data/asset-library/history.ndjson');
const catalog = assetLibraryManifestSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
const errors: string[] = [];
const contentIds = new Map<string, string[]>();
let fileBytes = 0;
let fileBackedAssets = 0;

for (const asset of catalog.assets) {
  if (!asset.uri.startsWith('/assets/')) {
    continue;
  }
  fileBackedAssets += 1;
  const publicPath = path.join(
    workspaceRoot,
    'apps/renderer/public',
    asset.uri.replace(/^\//u, ''),
  );
  try {
    const [content, details] = await Promise.all([readFile(publicPath), stat(publicPath)]);
    fileBytes += details.size;
    const hash = createHash('sha256').update(content).digest('hex');
    if (asset.bytes !== details.size) {
      errors.push(`${asset.id}: byte count ${details.size} does not match ${asset.bytes}`);
    }
    if (asset.sha256 !== hash) {
      errors.push(`${asset.id}: SHA-256 does not match catalog`);
    }
    const matchingIds = contentIds.get(hash) ?? [];
    matchingIds.push(asset.id);
    contentIds.set(hash, matchingIds);
  } catch (error) {
    errors.push(`${asset.id}: ${error instanceof Error ? error.message : 'unreadable asset'}`);
  }
}

const kinds = Object.fromEntries(
  (
    [
      'audio',
      'model_3d',
      'image_2d',
      'model_2d',
      'shader_style',
      'broadcast_graphic',
      'sound_effect',
    ] satisfies AssetKind[]
  ).map((kind) => [
    kind,
    catalog.assets.filter((asset) => asset.kind === kind && asset.status !== 'retired').length,
  ]),
);
const duplicateContent = [...contentIds.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([sha256, ids]) => ({ sha256, assetIds: ids }));
const report = {
  schemaVersion: 1,
  auditedAt: new Date().toISOString(),
  catalogGeneratedAt: catalog.generatedAt,
  libraryId: catalog.libraryId,
  valid: errors.length === 0,
  totalAssets: catalog.assets.length,
  readyAssets: catalog.assets.filter((asset) => asset.status === 'ready').length,
  previewAssets: catalog.assets.filter((asset) => asset.status === 'preview').length,
  retiredAssets: catalog.assets.filter((asset) => asset.status === 'retired').length,
  fileBackedAssets,
  proceduralAssets: catalog.assets.length - fileBackedAssets,
  fileBytes,
  programmeBoundAssets: catalog.assets.filter((asset) => asset.programmeIds.length > 0).length,
  reusableAssets: catalog.assets.filter((asset) => asset.programmeIds.length === 0).length,
  kinds,
  duplicateContent,
  errors,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await appendFile(historyPath, `${JSON.stringify(report)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!report.valid) {
  process.exitCode = 1;
}
