import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import {
  retainedPlayedSegmentIds,
  successfulPlayedSegmentIds,
} from '../../apps/generation-worker/src/playback-history.js';

const execFileAsync = promisify(execFile);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const endorHost = argument('endor-host') ?? process.env.ELSEWHERE_ENDOR_HOST ?? 'endor';
const containerName = argument('container') ?? 'elsewhere-cable';
const outputPath = path.resolve(
  workspaceRoot,
  argument('output') ?? 'data/runtime/played-segment-ids.txt',
);

const { stdout, stderr } = await execFileAsync(
  'ssh',
  [endorHost, 'docker', 'logs', containerName],
  {
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60_000,
  },
);
const segmentIds = successfulPlayedSegmentIds(`${stdout}\n${stderr}`);
const uniqueIds = [...new Set(segmentIds)];
let existingIds: string[] = [];
try {
  existingIds = (await readFile(outputPath, 'utf8'))
    .split(/\s+/u)
    .filter((segmentId) => /^seg_[a-z0-9_]+$/u.test(segmentId));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}
const retainedIds = retainedPlayedSegmentIds(existingIds, uniqueIds);
await mkdir(path.dirname(outputPath), { recursive: true });
const nextPath = `${outputPath}.${process.pid}.next`;
await writeFile(nextPath, `${retainedIds.join('\n')}\n`, 'utf8');
await rename(nextPath, outputPath);

process.stdout.write(
  `${JSON.stringify({
    endorHost,
    containerName,
    observedOccurrences: segmentIds.length,
    observedUniqueSegmentIds: uniqueIds.length,
    retainedUniqueSegmentIds: retainedIds.length,
    outputPath,
  })}\n`,
);
