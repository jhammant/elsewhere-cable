import type { QualityScorecard } from './quality-scorecard.js';

export const experimentArms = [
  {
    id: 'story_engine',
    capability: 'Premises, conflict, escalation and endings',
    primarySignal: 'editorial and novelty',
    rollout: 'newly generated material only',
  },
  {
    id: 'continuity',
    capability: 'Recurring characters, consequences and cross-channel callbacks',
    primarySignal: 'editorial, return interest and long-session retention',
    rollout: 'newly generated material only',
  },
  {
    id: 'performance',
    capability: 'Blocking, gestures, facial reactions and prop action',
    primarySignal: 'visual match, escalation and freeze ratio',
    rollout: 'guarded renderer handover',
  },
  {
    id: 'visual_medium',
    capability: 'New 2D, 3D and mixed-media rendering grammars',
    primarySignal: 'diversity, visual match and frame rate',
    rollout: 'guarded renderer handover',
  },
  {
    id: 'direction',
    capability: 'Shot grammar, camera rhythm and edit pacing',
    primarySignal: 'pace variety, shareability and freeze ratio',
    rollout: 'guarded renderer handover',
  },
  {
    id: 'broadcast_graphics',
    capability: 'Typography, captions, tickers, idents and information design',
    primarySignal: 'visual match, clarity and screenshot legibility',
    rollout: 'guarded renderer handover',
  },
  {
    id: 'music',
    capability: 'Original programme beds, jingles, stings and transitions',
    primarySignal: 'shareability, silence ratio and speech intelligibility',
    rollout: 'shadow mix, then guarded renderer handover',
  },
  {
    id: 'sound_design',
    capability: 'Room tone, prop sounds, audience reactions and signal texture',
    primarySignal: 'visual match, silence ratio and speech intelligibility',
    rollout: 'shadow mix, then guarded renderer handover',
  },
  {
    id: 'voice',
    capability: 'Voice identity, acting range, pronunciation and timing',
    primarySignal: 'dialogue coherence, intelligibility and audio reliability',
    rollout: 'newly packaged material only',
  },
  {
    id: 'channel_switching',
    capability: 'Format mix, segment length, interruptions and return scheduling',
    primarySignal: 'novelty, pace variety and retention',
    rollout: 'shadow schedule before live activation',
  },
  {
    id: 'runway',
    capability: 'Fresh-script throughput, TTS packaging and repeat reserves',
    primarySignal: 'fresh runway hours and programme uniqueness',
    rollout: 'Ghost workers and atomic content publishing',
  },
  {
    id: 'distribution',
    capability: 'Titles, thumbnails, schedules, highlights and external discovery',
    primarySignal: 'impressions, click-through rate and watch time',
    rollout: 'manual review before public changes',
  },
  {
    id: 'evaluation',
    capability: 'Critics, human ratings, analytics and experiment confidence',
    primarySignal: 'evidence coverage and prediction accuracy',
    rollout: 'offline evaluator only',
  },
  {
    id: 'audience_research',
    capability: 'Public viewing patterns and first-party retention evidence',
    primarySignal: 'candidate experiment lift, watch time and average view duration',
    rollout: 'research brief only; never direct prompt ingestion',
  },
  {
    id: 'reliability',
    capability: 'Audio continuity, watchdogs, fallback and stream recovery',
    primarySignal: 'live state, fallback, silence and freeze ratios',
    rollout: 'shadow probe before guarded operational change',
  },
] as const;

export type ExperimentArmId = (typeof experimentArms)[number]['id'];

export interface RankedExperimentArm {
  id: ExperimentArmId;
  priority: number;
  reason: string;
}

export function rankExperimentArms(scorecard: QualityScorecard): RankedExperimentArm[] {
  const priorities = new Map<ExperimentArmId, { priority: number; reasons: string[] }>();
  const add = (id: ExperimentArmId, priority: number, reason: string): void => {
    const current = priorities.get(id) ?? { priority: 0, reasons: [] };
    current.priority += priority;
    current.reasons.push(reason);
    priorities.set(id, current);
  };

  const effectiveRunwayReadiness =
    scorecard.freshRunwayHours === null
      ? scorecard.runwayReadiness
      : Math.min(100, (scorecard.freshRunwayHours / 24) * 100);
  if (effectiveRunwayReadiness !== null && effectiveRunwayReadiness < 25) {
    const gap = 25 - effectiveRunwayReadiness;
    add('runway', 200 + gap, 'fresh content runway is below six hours');
    add('story_engine', 24 + gap * 0.5, 'more approved original scripts are required');
  }
  if (scorecard.novelty !== null && scorecard.novelty < 80) {
    const gap = 80 - scorecard.novelty;
    add('story_engine', 45 + gap, 'programme uniqueness is below the 80% guardrail');
    add(
      'channel_switching',
      34 + gap * 0.8,
      'the live schedule is returning too many played slots',
    );
    add(
      'continuity',
      15 + gap * 0.25,
      'recurrence should create development rather than duplication',
    );
  }
  if (scorecard.editorial < 80) {
    const gap = 80 - scorecard.editorial;
    add('story_engine', 25 + gap, 'editorial quality is below 80');
    add('performance', 18 + gap * 0.7, 'visible acting can strengthen escalation and payoff');
    add('music', 8 + gap * 0.3, 'sound can improve pace and identity after reliability gates pass');
  }
  if (scorecard.diversity !== null && scorecard.diversity < 80) {
    const gap = 80 - scorecard.diversity;
    add('visual_medium', 24 + gap, 'production diversity is below 80');
    add('direction', 20 + gap * 0.8, 'shot language can separate programmes without new assets');
    add('broadcast_graphics', 15 + gap * 0.6, 'graphic packages can add low-cost visual range');
  }
  if (scorecard.reliability !== null && scorecard.reliability < 95) {
    const gap = 95 - scorecard.reliability;
    add('reliability', 90 + gap, 'delivered reliability is below the experiment threshold');
    add('voice', 24 + gap * 0.5, 'speech delivery is part of the audio guardrail');
    add('sound_design', 10 + gap * 0.2, 'sound changes must wait behind reliability work');
  }
  if (scorecard.evidenceCoverage < 80) {
    add('evaluation', 110, 'evidence coverage is too low for keep/discard decisions');
  }
  if (priorities.size === 0) {
    add(
      'music',
      20,
      'all primary quality gates are healthy, so sound identity is a bounded next arm',
    );
    add('continuity', 18, 'healthy delivery permits a longer-horizon return-interest experiment');
    add('distribution', 16, 'quality gates are healthy enough to test audience discovery');
  }
  if ((scorecard.concurrentViewers ?? 0) < 5) {
    add(
      'audience_research',
      12,
      'audience evidence is sparse, so research should propose—not directly activate—new hypotheses',
    );
  }

  return [...priorities.entries()]
    .map(([id, value]) => ({
      id,
      priority: Number(value.priority.toFixed(1)),
      reason: value.reasons.join('; '),
    }))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}
