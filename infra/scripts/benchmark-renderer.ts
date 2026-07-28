import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { hasFlag, readNumberArg } from './lib/args.js';
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

async function main(): Promise<void> {
  const durationSeconds = readNumberArg('seconds', 15);
  const output = resolveFromWorkspace('data/benchmarks/renderer.json');
  const screenshotPath = resolveFromWorkspace('data/benchmarks/renderer-preview.png');
  await ensureBuild();
  const executablePath = await findBrowser();
  const preview = startPreview();

  try {
    await waitForServer(baseUrl);
    const browser = await chromium.launch({
      executablePath,
      headless: !hasFlag('headed'),
      args: [
        '--enable-gpu',
        '--ignore-gpu-blocklist',
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
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => {
        consoleErrors.push(error.message);
      });

      await page.goto(`${baseUrl}/?benchmark=1&seconds=${durationSeconds}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForFunction('window.__ELSEWHERE_BENCHMARK__?.completed === true', undefined, {
        timeout: (durationSeconds + 30) * 1000,
      });
      const benchmark: unknown = await page.evaluate('window.__ELSEWHERE_BENCHMARK__');
      const typedBenchmark = benchmark as BrowserBenchmark | null;
      if (typedBenchmark === null) {
        throw new Error('Renderer did not publish benchmark results.');
      }

      await mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath });

      const result = {
        schemaVersion: 1,
        host: os.hostname(),
        browser: {
          product: 'Chromium',
          version: browser.version(),
          executable: path.basename(executablePath),
          headless: !hasFlag('headed'),
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
    const previewLogs = preview.logs.join('').trim();
    if (previewLogs.length > 0) {
      process.stderr.write(`${previewLogs}\n`);
    }
    throw error;
  } finally {
    preview.process.kill('SIGTERM');
  }
}

await main();
