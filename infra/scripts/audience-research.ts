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
  id?: string;
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

interface YoutubeSearchList {
  items?: Array<{ id?: { videoId?: string } }>;
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

function asSignals(
  response: YoutubeVideoList,
  source: PopularVideoSignal['source'],
): PopularVideoSignal[] {
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
        source,
      },
    ];
  });
}

async function youtubeRequest<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  });
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`YouTube research request failed (${response.status})`);
  }
  return body;
}

function youtubeUrl(pathname: string, parameters: Record<string, string>): URL {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${pathname}`);
  url.search = new URLSearchParams(parameters).toString();
  return url;
}

async function searchVideoIds(key: string, parameters: Record<string, string>): Promise<string[]> {
  const response = await youtubeRequest<YoutubeSearchList>(
    youtubeUrl('search', {
      part: 'snippet',
      type: 'video',
      maxResults: String(Math.min(25, maxResults)),
      regionCode: region,
      relevanceLanguage: 'en',
      safeSearch: 'strict',
      key,
      ...parameters,
    }),
  );
  return [
    ...new Set(
      (response.items ?? [])
        .map((item) => item.id?.videoId)
        .filter((id): id is string => id !== undefined),
    ),
  ];
}

async function videosById(
  key: string,
  ids: readonly string[],
  source: PopularVideoSignal['source'],
): Promise<PopularVideoSignal[]> {
  if (ids.length === 0) {
    return [];
  }
  const response = await youtubeRequest<YoutubeVideoList>(
    youtubeUrl('videos', {
      part: 'snippet,contentDetails,statistics,liveStreamingDetails',
      id: ids.slice(0, 50).join(','),
      key,
    }),
  );
  return asSignals(response, source);
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
  const publishedAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000).toISOString();
  const [popularResult, recentIdsResult, liveIdsResult] = await Promise.allSettled([
    youtubeRequest<YoutubeVideoList>(
      youtubeUrl('videos', {
        part: 'snippet,contentDetails,statistics,liveStreamingDetails',
        chart: 'mostPopular',
        regionCode: region,
        maxResults: String(maxResults),
        key,
      }),
    ),
    searchVideoIds(key, {
      order: 'viewCount',
      publishedAfter,
      videoCategoryId: categoryId,
    }),
    searchVideoIds(key, {
      eventType: 'live',
      order: 'viewCount',
      videoCategoryId: categoryId,
    }),
  ]);
  const mostPopular =
    popularResult.status === 'fulfilled' ? asSignals(popularResult.value, 'most_popular') : [];
  const recentEntertainment =
    recentIdsResult.status === 'fulfilled'
      ? await videosById(key, recentIdsResult.value, 'recent_entertainment')
      : [];
  const popularLive =
    liveIdsResult.status === 'fulfilled'
      ? await videosById(key, liveIdsResult.value, 'popular_live')
      : [];
  const signals = [...mostPopular, ...recentEntertainment, ...popularLive];
  if (signals.length === 0) {
    throw new Error('YouTube popularity sources returned no usable public videos');
  }
  const generatedAt = new Date().toISOString();
  const brief = deriveAudienceResearchBrief(signals, {
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
      samples: brief.samples,
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
