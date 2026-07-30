import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  deriveAudienceResearchBrief,
  parseIso8601Duration,
  type PopularVideoSignal,
} from '../../apps/generation-worker/src/audience-research.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(argument(name) ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`--${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

interface YoutubeVideo {
  snippet?: {
    title?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
}

interface YoutubeVideoList {
  items?: YoutubeVideo[];
}

async function apiKey(): Promise<string | null> {
  const filePath = argument('api-key-file') ?? process.env.YOUTUBE_DATA_API_KEY_FILE;
  const value =
    filePath === undefined
      ? process.env.YOUTUBE_DATA_API_KEY
      : await readFile(path.resolve(filePath), 'utf8');
  const key = value?.trim() ?? '';
  return key === '' ? null : key;
}

function asSignals(response: YoutubeVideoList): PopularVideoSignal[] {
  return (response.items ?? []).flatMap((item) => {
    const title = item.snippet?.title;
    const publishedAt = item.snippet?.publishedAt;
    if (title === undefined || publishedAt === undefined) {
      return [];
    }
    return [
      {
        title,
        publishedAt,
        durationSeconds: parseIso8601Duration(item.contentDetails?.duration ?? ''),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        isLive: item.snippet?.liveBroadcastContent === 'live',
      },
    ];
  });
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const outputPath = path.resolve(workspaceRoot, argument('output') ?? 'data/research/latest.json');
const historyPath = path.resolve(
  workspaceRoot,
  argument('history') ?? 'data/research/history.ndjson',
);
const region = (argument('region') ?? process.env.ELSEWHERE_RESEARCH_REGION ?? 'GB').toUpperCase();
const categoryId = argument('category') ?? process.env.ELSEWHERE_RESEARCH_CATEGORY_ID ?? '24';
const intervalHours = boundedInteger('interval-hours', 12, 1, 168);
const maxResults = boundedInteger('max-results', 50, 5, 50);

async function runResearch(): Promise<void> {
  const key = await apiKey();
  if (key === null) {
    process.stdout.write(
      `${JSON.stringify({
        status: 'skipped',
        reason: 'Configure YOUTUBE_DATA_API_KEY or YOUTUBE_DATA_API_KEY_FILE',
      })}\n`,
    );
    return;
  }
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.search = new URLSearchParams({
    part: 'snippet,contentDetails,statistics,liveStreamingDetails',
    chart: 'mostPopular',
    regionCode: region,
    videoCategoryId: categoryId,
    maxResults: String(maxResults),
    key,
  }).toString();
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  });
  const body = (await response.json()) as YoutubeVideoList;
  if (!response.ok) {
    throw new Error(`YouTube research request failed (${response.status})`);
  }
  const generatedAt = new Date().toISOString();
  const brief = deriveAudienceResearchBrief(asSignals(body), {
    generatedAt,
    region,
    categoryId,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  const nextPath = `${outputPath}.next`;
  await writeFile(nextPath, `${JSON.stringify(brief, null, 2)}\n`, 'utf8');
  await rename(nextPath, outputPath);
  await appendFile(historyPath, `${JSON.stringify(brief)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({
      status: 'recorded',
      generatedAt,
      sampleSize: brief.sampleSize,
      candidates: brief.candidates.map((candidate) => candidate.pattern),
      outputPath,
    })}\n`,
  );
}

async function runSafely(): Promise<void> {
  try {
    await runResearch();
  } catch (error) {
    process.stderr.write(
      `Audience research failed without affecting generation or playout: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
  }
}

await runSafely();
if (!process.argv.includes('--once')) {
  while (true) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalHours * 60 * 60 * 1_000);
    });
    await runSafely();
  }
}
