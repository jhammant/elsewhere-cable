import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { hasFlag, readArg, readNumberArg } from './lib/args.js';
import { pathExists, run } from './lib/command.js';
import { resolveFromWorkspace, writeJson } from './lib/files.js';

interface BrowserBenchmark {
  completed: boolean;
  averageFps: number;
  minimumFps: number;
  p95FrameTimeMs: number;
  droppedFrames: number;
  sampleCount: number;
  targetFps: number;
  durationSeconds: number;
  capturedAt: string;
  renderer: {
    api: string;
    device: string;
    vendor: string;
  };
}

const host = '127.0.0.1';
const port = 4173;
const baseUrl = `http://${host}:${port}`;

async function findBrowser(): Promise<string> {
  const configured = process.env.ELSEWHERE_CHROME_PATH;
  const candidates = [
    configured,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ].filter((candidate): candidate is string => candidate !== undefined);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No Chromium-based browser found. Set ELSEWHERE_CHROME_PATH to a Chrome or Chromium executable.',
  );
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // Vite has not finished starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Renderer preview did not become ready at ${url}`);
}

function startPreview(): { process: ChildProcess; logs: string[] } {
  const logs: string[] = [];
  const child = spawn(
    'pnpm',
    [
      '--filter',
      '@elsewhere-cable/renderer',
      'exec',
      'vite',
      'preview',
      '--host',
      host,
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const collect = (chunk: Buffer): void => {
    logs.push(chunk.toString('utf8'));
    if (logs.join('').length > 50_000) {
      logs.shift();
    }
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);
  return { process: child, logs };
}

async function ensureBuild(): Promise<void> {
  if (await pathExists(resolveFromWorkspace('apps/renderer/dist/index.html'))) {
    return;
  }
  const build = await run('pnpm', ['--filter', '@elsewhere-cable/renderer', 'build'], 120_000);
  if (build.exitCode !== 0) {
    throw new Error(`Renderer build failed:\n${build.stdout}\n${build.stderr}`);
  }
}

async function descendantResidentMemoryBytes(rootPid: number): Promise<number> {
  const result = await run('ps', ['-axo', 'pid=,ppid=,rss='], 3_000);
  if (result.exitCode !== 0) {
    return 0;
  }
  const processes = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/u))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      pid: Number(match[1]),
      parentPid: Number(match[2]),
      residentKib: Number(match[3]),
    }));
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const processInfo of processes) {
      if (descendants.has(processInfo.parentPid) && !descendants.has(processInfo.pid)) {
        descendants.add(processInfo.pid);
        changed = true;
      }
    }
  }
  return processes
    .filter((processInfo) => processInfo.pid !== rootPid && descendants.has(processInfo.pid))
    .reduce((total, processInfo) => total + processInfo.residentKib * 1_024, 0);
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main(): Promise<void> {
  const durationSeconds = readNumberArg('seconds', 15);
  const configuredUrl = readArg('url');
  const benchmarkUrl = configuredUrl ?? baseUrl;
  const output = resolveFromWorkspace('data/benchmarks/renderer.json');
  const screenshotPath = resolveFromWorkspace('data/benchmarks/renderer-preview.png');
  await ensureBuild();
  const executablePath = await findBrowser();
  const preview = configuredUrl === undefined ? startPreview() : null;

  try {
    await waitForServer(benchmarkUrl);
    const browser = await chromium.launch({
      executablePath,
      headless: !hasFlag('headed'),
      args: [
        '--enable-gpu',
        '--ignore-gpu-blocklist',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
    });

    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });
      const consoleErrors: string[] = [];
      const memorySamples: number[] = [];
      const sampleMemory = (): void => {
        void descendantResidentMemoryBytes(process.pid).then((bytes) => {
          if (bytes > 0) {
            memorySamples.push(bytes);
          }
        });
      };
      sampleMemory();
      const memoryTimer = setInterval(sampleMemory, 500);
      memoryTimer.unref();
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => {
        consoleErrors.push(error.message);
      });

      const url = new URL(benchmarkUrl);
      url.searchParams.set('benchmark', '1');
      url.searchParams.set('seconds', String(durationSeconds));
      if (configuredUrl !== undefined) {
        url.searchParams.delete('benchmark');
      }
      await page.goto(url.toString(), {
        waitUntil: 'networkidle',
      });
      try {
        await page.waitForFunction(
          'window.__ELSEWHERE_BENCHMARK__?.completed === true',
          undefined,
          {
            timeout: (durationSeconds + 30) * 1000,
          },
        );
      } catch (error) {
        clearInterval(memoryTimer);
        const diagnostic: unknown = await page.evaluate(`({
          benchmark: window.__ELSEWHERE_BENCHMARK__,
          readyState: document.readyState,
          status: document.querySelector('#playout-status')?.textContent,
          mode: document.querySelector('#playout-mode')?.textContent
        })`);
        await mkdir(path.dirname(screenshotPath), { recursive: true });
        await page.screenshot({ path: screenshotPath });
        throw new Error(
          `Renderer benchmark did not complete: ${JSON.stringify(diagnostic)}; console errors: ${consoleErrors.join(' | ')}`,
          { cause: error },
        );
      }
      const benchmark: unknown = await page.evaluate('window.__ELSEWHERE_BENCHMARK__');
      const typedBenchmark = benchmark as BrowserBenchmark | null;
      if (typedBenchmark === null) {
        throw new Error('Renderer did not publish benchmark results.');
      }

      await mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath });
      clearInterval(memoryTimer);

      const result = {
        schemaVersion: 1,
        host: os.hostname(),
        browser: {
          product: 'Chromium',
          version: browser.version(),
          executable: path.basename(executablePath),
          headless: !hasFlag('headed'),
          url: benchmarkUrl,
        },
        scene: {
          resolution: { width: 1280, height: 720 },
          targetFps: 25,
          activeSetCount: 1,
          visibleCharacterCount: 2,
        },
        benchmark: typedBenchmark,
        validation: {
          targetMet: typedBenchmark.averageFps >= 25,
          noPageErrors: consoleErrors.length === 0,
          consoleErrors,
        },
        resources: {
          processTree: configuredUrl === undefined ? 'browser-and-preview-server' : 'browser',
          averageResidentMemoryBytes: Math.round(average(memorySamples)),
          peakResidentMemoryBytes: Math.max(0, ...memorySamples),
          sampleCount: memorySamples.length,
        },
        artefacts: {
          screenshot: path.relative(process.cwd(), screenshotPath),
        },
      };

      await writeJson(output, result);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

      if (!result.validation.targetMet || !result.validation.noPageErrors) {
        process.exitCode = 1;
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    const previewLogs = preview?.logs.join('').trim() ?? '';
    if (previewLogs.length > 0) {
      process.stderr.write(`${previewLogs}\n`);
    }
    throw error;
  } finally {
    preview?.process.kill('SIGTERM');
  }
}

await main();
