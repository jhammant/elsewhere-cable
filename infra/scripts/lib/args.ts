export function readArg(name: string, fallback?: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return fallback;
  }

  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    return fallback;
  }

  return value;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function readNumberArg(name: string, fallback: number): number {
  const raw = readArg(name);
  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }

  return value;
}
