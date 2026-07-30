import { execFile } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

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
const segmentIds = [...`${stdout}\n${stderr}`.matchAll(/\bseg_[a-z0-9_]+\b/gu)].map(
  (match) => match[0],
);
const uniqueIds = [...new Set(segmentIds)];
await mkdir(path.dirname(outputPath), { recursive: true });
const nextPath = `${outputPath}.${process.pid}.next`;
await writeFile(nextPath, `${uniqueIds.join('\n')}\n`, 'utf8');
await rename(nextPath, outputPath);

process.stdout.write(
  `${JSON.stringify({
    endorHost,
    containerName,
    observedOccurrences: segmentIds.length,
    uniqueSegmentIds: uniqueIds.length,
    outputPath,
  })}\n`,
);
