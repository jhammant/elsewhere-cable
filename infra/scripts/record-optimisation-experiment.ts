import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function safeText(value: string, name: string, maximum: number): string {
  const cleaned = [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127 || character === '<' || character === '>' ? ' ' : character;
    })
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
  if (cleaned === '' || cleaned.length > maximum) {
    throw new Error(`--${name} must contain 1-${maximum} safe characters`);
  }
  return cleaned;
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const outputPath = path.resolve(
  workspaceRoot,
  argument('output') ?? 'data/optimisation/experiments.ndjson',
);
const build = safeText(argument('build') ?? 'uncommitted', 'build', 80);
const surface = safeText(argument('surface') ?? 'unspecified', 'surface', 80);
const hypothesis = safeText(
  argument('hypothesis') ?? argument('description') ?? 'Unlabelled bounded experiment',
  'hypothesis',
  300,
);
const status = argument('status') ?? 'active';
if (!['active', 'keep', 'discard', 'crash'].includes(status)) {
  throw new Error('--status must be active, keep, discard, or crash');
}
const record = {
  schemaVersion: 1,
  experimentId:
    argument('id') ??
    `exp_${new Date().toISOString().replace(/\D/gu, '').slice(0, 14)}_${build.replace(
      /[^a-z0-9]+/giu,
      '_',
    )}`,
  startedAt: new Date().toISOString(),
  build,
  surface,
  hypothesis,
  status,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await appendFile(outputPath, `${JSON.stringify(record)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ ...record, outputPath }, null, 2)}\n`);
