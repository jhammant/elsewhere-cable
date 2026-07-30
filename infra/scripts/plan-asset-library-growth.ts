import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assetGrowthRequestSchema,
  assetLibraryManifestSchema,
  optimisationBriefSchema,
  type AssetGrowthRequest,
} from '../../packages/schemas/src/index.js';
import { nextAssetGrowthRequest } from '../../apps/generation-worker/src/asset-growth.js';

const workspaceRoot = process.cwd();
const catalogPath = path.join(workspaceRoot, 'apps/renderer/public/assets/library/catalog.json');
const briefPath = path.join(workspaceRoot, 'data/optimisation/current-brief.json');
const requestsRoot = path.join(workspaceRoot, 'data/asset-library/requests');
const historyPath = path.join(requestsRoot, 'history.ndjson');
const pendingRoot = path.join(requestsRoot, 'pending');

async function currentBrief() {
  try {
    return optimisationBriefSchema.parse(JSON.parse(await readFile(briefPath, 'utf8')));
  } catch {
    return null;
  }
}

async function existingRequests(): Promise<AssetGrowthRequest[]> {
  try {
    const lines = (await readFile(historyPath, 'utf8')).split('\n').filter(Boolean);
    return lines.map((line) => assetGrowthRequestSchema.parse(JSON.parse(line)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

const manifest = assetLibraryManifestSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
const existing = await existingRequests();
const request = nextAssetGrowthRequest(
  manifest,
  new Set(existing.map((entry) => entry.requestKey)),
  await currentBrief(),
);

if (request === null) {
  process.stdout.write(
    `${JSON.stringify({ queued: false, reason: 'frontier-already-requested' })}\n`,
  );
} else {
  await mkdir(pendingRoot, { recursive: true });
  const serialized = `${JSON.stringify(request, null, 2)}\n`;
  await writeFile(path.join(pendingRoot, `${request.requestId}.json`), serialized, 'utf8');
  await appendFile(historyPath, `${JSON.stringify(request)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({
      queued: true,
      requestId: request.requestId,
      kind: request.kind,
      role: request.role,
      priority: request.priority,
    })}\n`,
  );
}
