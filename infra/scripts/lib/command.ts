import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CommandResult {
  available: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export async function run(
  command: string,
  args: readonly string[] = [],
  timeoutMs = 10_000,
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, [...args], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: timeoutMs,
    });

    return {
      available: true,
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: unknown) {
    const details = error as NodeJS.ErrnoException & {
      code?: string | number;
      stdout?: string;
      stderr?: string;
    };

    return {
      available: details.code !== 'ENOENT',
      exitCode: typeof details.code === 'number' ? details.code : null,
      stdout: details.stdout?.trim() ?? '',
      stderr: details.stderr?.trim() ?? details.message,
    };
  }
}

export async function commandExists(command: string): Promise<boolean> {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = await run(lookup, [command], 3_000);
  return result.exitCode === 0 && result.stdout.length > 0;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function firstLine(value: string): string | null {
  return (
    value
      .split(/\r?\n/u)
      .find((line) => line.trim().length > 0)
      ?.trim() ?? null
  );
}
