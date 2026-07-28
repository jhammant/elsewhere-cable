import process from 'node:process';

const baseUrl = process.env.ELSEWHERE_CONTROL_URL ?? 'http://127.0.0.1:4174';

try {
  const response = await fetch(`${baseUrl}/api/playout/state`, {
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  process.stdout.write(`${JSON.stringify(await response.json(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `Elsewhere Cable is not reachable at ${baseUrl}: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
}
