export const audiencePatternCatalog = [
  {
    id: 'visible_transformation',
    titlePattern:
      /\b(?:before|after|became|becomes|build|built|makeover|transform\w*|turn\w* into)\b/iu,
    hypothesis:
      'Test a visible state change at every beat, while keeping the premise and characters wholly original.',
    surface: 'story_engine',
  },
  {
    id: 'bounded_challenge',
    titlePattern: /\b(?:challenge|compete|competition|last to|versus|vs\.?|win\w*)\b/iu,
    hypothesis:
      'Test two clear incompatible goals under one escalating constraint, without borrowing a source format.',
    surface: 'story_engine',
  },
  {
    id: 'explanation',
    titlePattern: /\b(?:how|why|explains?|guide|inside|science|truth)\b/iu,
    hypothesis:
      'Test an earnest authority explaining one surreal rule through increasingly concrete consequences.',
    surface: 'story_engine',
  },
  {
    id: 'reveal_chain',
    titlePattern: /\b(?:discover\w*|found|hidden|mystery|reveals?|secret|unexpected)\b/iu,
    hypothesis: 'Test a chain in which every answer visibly creates a more specific comic problem.',
    surface: 'story_engine',
  },
  {
    id: 'ranked_accumulation',
    titlePattern: /\b(?:best|biggest|countdown|every|ranking|top \d+|worst)\b/iu,
    hypothesis:
      'Test an accumulating list whose ordering becomes the source of conflict, not a copied countdown.',
    surface: 'story_engine',
  },
  {
    id: 'social_reaction',
    titlePattern: /\b(?:react\w*|response|surprise\w*|told|asked|prank)\b/iu,
    hypothesis:
      'Test a fast chain of distinct character reactions that materially changes the scene each time.',
    surface: 'performance',
  },
  {
    id: 'live_occasion',
    titlePattern: /\b(?:live|premiere|final|opening|special|tonight)\b/iu,
    hypothesis:
      'Test a programme that feels like an interruptible one-time event with an immediate on-air stake.',
    surface: 'channel_switching',
  },
  {
    id: 'process_satisfaction',
    titlePattern: /\b(?:cook\w*|craft\w*|create\w*|fix\w*|making|repair\w*|restor\w*)\b/iu,
    hypothesis:
      'Test a legible physical process whose side effects escalate while its original goal stays clear.',
    surface: 'performance',
  },
] as const;

export type AudiencePatternId = (typeof audiencePatternCatalog)[number]['id'];
export type AudienceResearchSource =
  | 'youtube_public_popularity'
  | 'youtube_public_web_research';

export interface PopularVideoSignal {
  title: string;
  durationSeconds: number;
  viewCount: number;
  publishedAt: string;
  isLive: boolean;
  source: 'most_popular' | 'recent_entertainment' | 'popular_live';
}

export interface AudienceResearchCandidate {
  pattern: AudiencePatternId;
  evidenceCount: number;
  sampleShare: number;
  relativeViewVelocity: number;
  hypothesis: string;
  surface: string;
}

export interface AudienceResearchBrief {
  schemaVersion: 1;
  generatedAt: string;
  source: AudienceResearchSource;
  region: string;
  categoryId: string;
  sampleSize: number;
  samples: {
    mostPopular: number;
    recentEntertainment: number;
    popularLive: number;
  };
  duration: {
    medianSeconds: number | null;
    underFiveMinutesShare: number;
    fiveToTwentyMinutesShare: number;
    overTwentyMinutesShare: number;
    liveShare: number;
  };
  candidates: AudienceResearchCandidate[];
  privacy: {
    sourceTextRetained: false;
    descriptionsIngested: false;
    rawTextAllowedInPrompts: false;
  };
}

export interface SanitizedAudienceEvidence {
  pattern: AudiencePatternId;
  evidenceCount: number;
  sampleShare: number;
  relativeViewVelocity: number;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function ratio(count: number, total: number): number {
  return total === 0 ? 0 : Number((count / total).toFixed(3));
}

function boundedRatio(value: number): number {
  return Number(Math.max(0, Math.min(1, finiteNonNegative(value))).toFixed(3));
}

function boundedVelocity(value: number): number {
  return Number(Math.max(0, Math.min(100, finiteNonNegative(value))).toFixed(2));
}

function viewVelocity(video: PopularVideoSignal, generatedAt: string): number {
  const ageDays = Math.max(
    1,
    (Date.parse(generatedAt) - Date.parse(video.publishedAt)) / (24 * 60 * 60 * 1_000),
  );
  return finiteNonNegative(video.viewCount) / ageDays;
}

export function deriveAudienceResearchBrief(
  videos: readonly PopularVideoSignal[],
  options: { generatedAt: string; region: string; categoryId: string },
): AudienceResearchBrief {
  const safeVideos = videos.filter(
    (video) =>
      Number.isFinite(video.durationSeconds) &&
      video.durationSeconds >= 0 &&
      Number.isFinite(Date.parse(video.publishedAt)),
  );
  const velocities = safeVideos.map((video) => viewVelocity(video, options.generatedAt));
  const medianVelocity = Math.max(1, median(velocities) ?? 1);
  const candidates = audiencePatternCatalog
    .map((pattern) => {
      const matches = safeVideos.filter((video) => pattern.titlePattern.test(video.title));
      const patternVelocity = median(
        matches.map((video) => viewVelocity(video, options.generatedAt)),
      );
      return {
        pattern: pattern.id,
        evidenceCount: matches.length,
        sampleShare: ratio(matches.length, safeVideos.length),
        relativeViewVelocity: Number(((patternVelocity ?? 0) / medianVelocity).toFixed(2)),
        hypothesis: pattern.hypothesis,
        surface: pattern.surface,
      };
    })
    .filter((candidate) => candidate.evidenceCount >= 2)
    .sort(
      (left, right) =>
        right.sampleShare * Math.max(0.5, right.relativeViewVelocity) -
          left.sampleShare * Math.max(0.5, left.relativeViewVelocity) ||
        right.evidenceCount - left.evidenceCount ||
        left.pattern.localeCompare(right.pattern),
    )
    .slice(0, 5);
  const durations = safeVideos.map((video) => finiteNonNegative(video.durationSeconds));

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt,
    source: 'youtube_public_popularity',
    region: options.region,
    categoryId: options.categoryId,
    sampleSize: safeVideos.length,
    samples: {
      mostPopular: safeVideos.filter((video) => video.source === 'most_popular').length,
      recentEntertainment: safeVideos.filter((video) => video.source === 'recent_entertainment')
        .length,
      popularLive: safeVideos.filter((video) => video.source === 'popular_live').length,
    },
    duration: {
      medianSeconds: median(durations),
      underFiveMinutesShare: ratio(
        safeVideos.filter((video) => video.durationSeconds < 5 * 60).length,
        safeVideos.length,
      ),
      fiveToTwentyMinutesShare: ratio(
        safeVideos.filter(
          (video) => video.durationSeconds >= 5 * 60 && video.durationSeconds <= 20 * 60,
        ).length,
        safeVideos.length,
      ),
      overTwentyMinutesShare: ratio(
        safeVideos.filter((video) => video.durationSeconds > 20 * 60).length,
        safeVideos.length,
      ),
      liveShare: ratio(safeVideos.filter((video) => video.isLive).length, safeVideos.length),
    },
    candidates,
    privacy: {
      sourceTextRetained: false,
      descriptionsIngested: false,
      rawTextAllowedInPrompts: false,
    },
  };
}

export function createSanitizedAudienceResearchBrief(
  evidence: readonly SanitizedAudienceEvidence[],
  options: {
    generatedAt: string;
    region: string;
    categoryId: string;
    sampleSize: number;
  },
): AudienceResearchBrief {
  if (!Number.isFinite(Date.parse(options.generatedAt))) {
    throw new Error('generatedAt must be a valid ISO timestamp');
  }
  const sampleSize = Math.max(0, Math.min(500, Math.trunc(options.sampleSize)));
  const candidates = evidence
    .flatMap((candidate) => {
      const pattern = audiencePatternCatalog.find((entry) => entry.id === candidate.pattern);
      if (pattern === undefined || !Number.isInteger(candidate.evidenceCount)) {
        return [];
      }
      return [
        {
          pattern: pattern.id,
          evidenceCount: Math.max(0, Math.min(500, candidate.evidenceCount)),
          sampleShare: boundedRatio(candidate.sampleShare),
          relativeViewVelocity: boundedVelocity(candidate.relativeViewVelocity),
          hypothesis: pattern.hypothesis,
          surface: pattern.surface,
        },
      ];
    })
    .filter((candidate) => candidate.evidenceCount >= 2)
    .sort(
      (left, right) =>
        right.sampleShare * Math.max(0.5, right.relativeViewVelocity) -
          left.sampleShare * Math.max(0.5, left.relativeViewVelocity) ||
        right.evidenceCount - left.evidenceCount ||
        left.pattern.localeCompare(right.pattern),
    )
    .slice(0, 5);

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt,
    source: 'youtube_public_web_research',
    region: options.region,
    categoryId: options.categoryId,
    sampleSize,
    samples: {
      mostPopular: sampleSize,
      recentEntertainment: 0,
      popularLive: 0,
    },
    duration: {
      medianSeconds: null,
      underFiveMinutesShare: 0,
      fiveToTwentyMinutesShare: 0,
      overTwentyMinutesShare: 0,
      liveShare: 0,
    },
    candidates,
    privacy: {
      sourceTextRetained: false,
      descriptionsIngested: false,
      rawTextAllowedInPrompts: false,
    },
  };
}

export function selectAudienceResearchCandidate(
  brief: AudienceResearchBrief,
  windowIndex: number,
): AudienceResearchCandidate | undefined {
  if (brief.candidates.length === 0) {
    return undefined;
  }
  const safeWindow = Number.isFinite(windowIndex) ? Math.abs(Math.trunc(windowIndex)) : 0;
  return brief.candidates[safeWindow % brief.candidates.length];
}

export function parseIso8601Duration(value: string): number {
  const match =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/u.exec(
      value,
    );
  if (match === null) {
    return 0;
  }
  return Math.round(
    Number(match[1] ?? 0) * 86_400 +
      Number(match[2] ?? 0) * 3_600 +
      Number(match[3] ?? 0) * 60 +
      Number(match[4] ?? 0),
  );
}
