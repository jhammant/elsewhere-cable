import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Route } from 'playwright-core';
import {
  playoutManifestSchema,
  segmentPackageSchema,
  type SegmentPackage,
} from '../../packages/schemas/src/index.js';
import { pathExists, run } from './lib/command.js';
import { writeJson } from './lib/files.js';

const workspaceRoot = process.cwd();
const host = '127.0.0.1';
const port = 4174;
const baseUrl = `http://${host}:${port}`;
const outputRoot = path.join(workspaceRoot, 'data/qa/assets-v2');

interface VisualScenario {
  slug: string;
  title: string;
  premise: string;
  format: SegmentPackage['programme']['format'];
  medium: NonNullable<SegmentPackage['visualMedium']>;
}

const scenarios: readonly VisualScenario[] = [
  {
    slug: 'paper-bus-stop-kitchen',
    title: 'Breakfast Route Review',
    premise: 'A paper kitchen committee inspects the suburban bus stop beside the cupboards.',
    format: 'sitcom',
    medium: 'paper_cutout',
  },
  {
    slug: 'indoor-rain-weather-studio',
    title: 'The Dry Circle Forecast',
    premise: 'A miniature weather desk audits rain routed through a filing cabinet.',
    format: 'public_access',
    medium: 'storybook_wash',
  },
  {
    slug: 'pixel-railway-courtroom',
    title: 'Platform Claims Court',
    premise: 'A pixel railway courtroom hears evidence from the station luggage.',
    format: 'public_access',
    medium: 'pixel_broadcast',
  },
  {
    slug: 'shadow-cavern-newsroom',
    title: 'News Beneath the News',
    premise: 'An underground shadow newsroom reports a dispute between cavern geology layers.',
    format: 'news',
    medium: 'shadow_theatre',
  },
  {
    slug: 'watercolour-aquarium-council',
    title: 'Shell Gallery Minutes',
    premise: 'An underwater aquarium council opens its quiet civic chamber to vacant shells.',
    format: 'public_access',
    medium: 'storybook_wash',
  },
  {
    slug: 'fluorescent-dental-gameshow',
    title: 'Whose Tooth Is This',
    premise: 'A fluorescent dental game show prepares its tooth buzzer and contest podiums.',
    format: 'ident',
    medium: 'corporate_vector',
  },
  {
    slug: 'xerox-shadow-union-office',
    title: 'The Silhouette Branch',
    premise: 'A xerox union office files a labour motion on behalf of household shadows.',
    format: 'public_access',
    medium: 'xerox_punk',
  },
  {
    slug: 'stained-glass-receipt-shop',
    title: 'Receipt Reliquary',
    premise: 'A stained glass shopping showroom displays receipts beside abstract appliances.',
    format: 'shopping',
    medium: 'stained_glass',
  },
  {
    slug: 'thermal-night-bakery',
    title: 'Cold Cabinet Inspection',
    premise: 'A thermal night bakery inspection compares its ovens with one cold pastry cabinet.',
    format: 'news',
    medium: 'thermal_camera',
  },
  {
    slug: 'isometric-rotary-call-centre',
    title: 'Please Hold Below',
    premise: 'An isometric call centre routes every telephone through one rotary service hatch.',
    format: 'public_access',
    medium: 'isometric_manual',
  },
  {
    slug: 'clay-roundabout-newsdesk',
    title: 'Island Traffic Desk',
    premise: 'A clay local news desk reports directly from the central roundabout roads.',
    format: 'news',
    medium: 'storybook_wash',
  },
  {
    slug: 'ink-clock-break-room',
    title: 'The Pendulum Tea Break',
    premise: 'An ink night watchman enters a clock break room between the gears.',
    format: 'sitcom',
    medium: 'ink_monochrome',
  },
];

function scenarioSegment(scenario: VisualScenario, index: number): SegmentPackage {
  return segmentPackageSchema.parse({
    schemaVersion: 1,
    segmentId: `seg_asset_qa_${scenario.slug.replaceAll('-', '_')}`,
    channel: {
      id: `channel_asset_qa_${index}`,
      number: 8_000_000_000 + index * 7_919,
      name: `Asset Reception ${index + 1}`,
      realityId: `ASSET-QA-${index + 1}`,
    },
    programme: {
      id: `asset_qa_${scenario.slug.replaceAll('-', '_')}`,
      title: scenario.title,
      format: scenario.format,
      premise: scenario.premise,
    },
    durationMs: 5_000,
    visualStyle: `asset_qa_${scenario.medium}`,
    visualMedium: scenario.medium,
    castArchetype: 'mixed',
    pacing: 'slow_burn',
    tone: ['dry', 'surreal'],
    events: [
      { atMs: 0, type: 'camera.cut', camera: 'CAMERA_WIDE' },
      {
        atMs: 1_000,
        type: 'graphic.show',
        graphic: 'LOWER_THIRD',
        text: scenario.title,
      },
    ],
    continuityUpdates: [],
    suggestedExit: {
      earliestMs: 4_200,
      preferredMs: 4_800,
      transition: 'STATIC_BURST',
    },
    production: {
      generatedAt: '2026-07-31T19:23:36.000Z',
      generator: 'asset-visual-qa',
      model: 'deterministic-fixture',
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: true,
    },
  });
}

const segments = scenarios.map(scenarioSegment);
const manifest = playoutManifestSchema.parse({
  schemaVersion: 1,
  generatedAt: '2026-07-31T19:23:36.000Z',
  totalDurationMs: segments.reduce((total, segment) => total + segment.durationMs, 0),
  segments: segments.map((segment) => ({
    segmentId: segment.segmentId,
    channelNumber: segment.channel.number,
    channelName: segment.channel.name,
    programmeTitle: segment.programme.title,
    format: segment.programme.format,
    durationMs: segment.durationMs,
    packagePath: `${segment.segmentId}/segment.json`,
    approved: true,
  })),
});

async function findBrowser(): Promise<string> {
  const candidates = [
    process.env.ELSEWHERE_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter((candidate): candidate is string => candidate !== undefined);
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  throw new Error('No local Chromium browser is available for asset visual QA');
}

async function waitForServer(): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Renderer preview did not start for asset visual QA');
}

function startPreview(): ChildProcess {
  return spawn(
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
      cwd: workspaceRoot,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

const build = await run('pnpm', ['--filter', '@elsewhere-cable/renderer', 'build'], 120_000);
if (build.exitCode !== 0) {
  throw new Error(`Renderer build failed: ${build.stderr || build.stdout}`);
}
await mkdir(outputRoot, { recursive: true });
const preview = startPreview();
const consoleErrors: string[] = [];

try {
  await waitForServer();
  const browser = await chromium.launch({
    executablePath: await findBrowser(),
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.route('**/api/playout/manifest', async (route: Route) => {
      await route.fulfill({ json: manifest });
    });
    await page.route('**/api/playout/segments/*', async (route: Route) => {
      const segmentId = decodeURIComponent(route.request().url().split('/').at(-1) ?? '');
      const segment = segments.find((candidate) => candidate.segmentId === segmentId);
      if (segment === undefined) {
        await route.fulfill({ status: 404, body: 'missing fixture' });
        return;
      }
      await route.fulfill({ json: segment });
    });
    await page.route('**/api/playout/telemetry', async (route: Route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__ELSEWHERE_RENDERER_ACTIVE__ === true');

    const screenshots: string[] = [];
    for (const scenario of scenarios) {
      await page.waitForFunction(
        (title) => document.querySelector('#programme-title')?.textContent === title,
        scenario.title,
        { timeout: 8_000 },
      );
      await page.waitForTimeout(1_450);
      const graphicScreenshotPath = path.join(outputRoot, `${scenario.slug}-graphic.png`);
      await page.screenshot({ path: graphicScreenshotPath });
      screenshots.push(path.relative(workspaceRoot, graphicScreenshotPath));
      await page.waitForTimeout(2_150);
      const stageScreenshotPath = path.join(outputRoot, `${scenario.slug}-stage.png`);
      await page.screenshot({ path: stageScreenshotPath });
      screenshots.push(path.relative(workspaceRoot, stageScreenshotPath));
    }

    const result = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      scenarioCount: scenarios.length,
      screenshotCount: screenshots.length,
      consoleErrors,
      screenshots,
      passed: screenshots.length === scenarios.length * 2 && consoleErrors.length === 0,
    };
    await writeJson(path.join(outputRoot, 'report.json'), result);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.passed) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
} finally {
  preview.kill('SIGTERM');
}
