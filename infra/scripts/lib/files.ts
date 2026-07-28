import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const content = await format(JSON.stringify(value), {
    parser: 'json',
    printWidth: 100,
  });
  await writeFile(filePath, content, 'utf8');
}

export async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}

export function resolveFromWorkspace(filePath: string): string {
  return path.resolve(process.cwd(), filePath);
}
