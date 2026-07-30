import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  playoutManifestSchema,
  preparedScriptSchema,
  segmentPackageSchema,
} from '../../packages/schemas/src/index.js';
import { signalSurfDrafts } from '../../apps/generation-worker/src/signal-surf.js';
import { critiquePremise } from '../../apps/generation-worker/src/premise-critic.js';
import {
  noveltyIssues,
  recordFromDraft,
  recordFromSegment,
  type CreativeRecord,
} from '../../apps/generation-worker/src/novelty.js';
import {
  assertPreviewSafe,
  proposalQualityIssues,
} from '../../apps/generation-worker/src/production.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const queueRoot = path.resolve(workspaceRoot, argument('script-queue') ?? 'data/script-reservoir');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');
const queueBuckets = ['pending', 'completed', 'failed'] as const;

async function queuedScripts(): Promise<Array<ReturnType<typeof preparedScriptSchema.parse>>> {
  const scripts: Array<ReturnType<typeof preparedScriptSchema.parse>> = [];
  for (const bucket of queueBuckets) {
    const directory = path.join(queueRoot, bucket);
    try {
      for (const fileName of await readdir(directory)) {
        if (!/^draft_[a-z0-9]+\.json$/u.test(fileName)) {
          continue;
        }
        try {
          scripts.push(
            preparedScriptSchema.parse(
              JSON.parse(await readFile(path.join(directory, fileName), 'utf8')),
            ),
          );
        } catch {
          // A corrupt legacy queue item cannot suppress a valid curated fragment.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return scripts;
}

async function playedHistory(): Promise<CreativeRecord[]> {
  const history: CreativeRecord[] = [];
  try {
    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(segmentsRoot, 'manifest.json'), 'utf8')),
    );
    for (const entry of manifest.segments) {
      try {
        const segment = segmentPackageSchema.parse(
          JSON.parse(await readFile(path.join(segmentsRoot, entry.packagePath), 'utf8')),
        );
        history.push(recordFromSegment(segment));
      } catch {
        // Missing legacy packages do not prevent safe, new material from being queued.
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return history;
}

const queued = await queuedScripts();
const existingTitles = new Set(queued.map((script) => script.draft.programmeTitle.toLowerCase()));
const candidates = signalSurfDrafts.filter(
  (draft) => !existingTitles.has(draft.programmeTitle.toLowerCase()),
);
const history = [
  ...(await playedHistory()),
  ...queued.map((script) => recordFromDraft(script.draft)),
];

for (const draft of candidates) {
  assertPreviewSafe(draft);
  const issues = [
    ...proposalQualityIssues(draft),
    ...critiquePremise(draft).reasons,
    ...noveltyIssues(draft, history),
  ];
  if (issues.length > 0) {
    throw new Error(`${draft.programmeTitle} failed editorial gates: ${issues.join('; ')}`);
  }
  history.push(recordFromDraft(draft));
}

const pendingRoot = path.join(queueRoot, 'pending');
await mkdir(pendingRoot, { recursive: true });
for (const draft of candidates) {
  const draftId = `draft_${randomUUID().replaceAll('-', '')}`;
  const prepared = preparedScriptSchema.parse({
    schemaVersion: 1,
    draftId,
    preparedAt: new Date().toISOString(),
    generator: 'signal-surf-editorial-pack',
    model: 'human-directed-editorial',
    draft,
  });
  await writeFile(
    path.join(pendingRoot, `${draftId}.json`),
    `${JSON.stringify(prepared, null, 2)}\n`,
    'utf8',
  );
}

process.stdout.write(
  `${JSON.stringify({
    queueRoot,
    available: signalSurfDrafts.length,
    added: candidates.length,
    skipped: signalSurfDrafts.length - candidates.length,
    visualMedia: candidates.map((draft) => draft.visualMedium),
  })}\n`,
);
