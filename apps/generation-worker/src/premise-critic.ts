import type { GeneratedSegmentDraft } from '@elsewhere-cable/schemas';
import { containsSpokenStageDirection } from './dialogue-quality.js';

export interface PremiseCritique {
  accepted: boolean;
  scores: {
    clarity: number;
    comicRule: number;
    escalation: number;
    visualPayoff: number;
    castPurpose: number;
  };
  reasons: string[];
}

function words(value: string): string[] {
  return value.trim().split(/\s+/u).filter(Boolean);
}

export function critiquePremise(draft: GeneratedSegmentDraft): PremiseCritique {
  const reasons: string[] = [];
  const premiseWords = words(draft.premise);
  const speakers = new Set(draft.dialogue.map((line) => line.speaker));
  const lineLengths = draft.dialogue.map((line) => words(line.text).length);
  const disconnectedLanguage = /\b(?:random|wacky|nonsense|for no reason|anything can happen)\b/iu;
  const actionLines = draft.dialogue.filter((line) => line.action !== 'IDLE').length;
  const genericPerilLanguage =
    /\b(?:warn|warning|careful|danger|safe|safety|too late|keep .{0,20} away|forbidden zone|must not|do not touch|it'?s spreading|emergency hatch|only exit|cannot move|breaking)\b/iu;
  const genericPerilLines = draft.dialogue.filter((line) =>
    genericPerilLanguage.test(line.text),
  ).length;
  const stageDirectionLines = draft.dialogue.filter((line) =>
    containsSpokenStageDirection(line.text),
  ).length;

  if (draft.channelName.trim().toLowerCase() === 'elsewhere cable') {
    reasons.push('Elsewhere Cable is the network identity and cannot be a channel name');
  }
  if (premiseWords.length < 7 || premiseWords.length > 38) {
    reasons.push('premise must state one legible comic rule in 7–38 words');
  }
  if (speakers.size < 2 || speakers.size > 6) {
    reasons.push('scene needs 2–6 purposeful speaking roles');
  }
  if (lineLengths.some((length) => length < 3 || length > 34)) {
    reasons.push('dialogue lines must be performable beats of 3–34 words');
  }
  if (stageDirectionLines > 0) {
    reasons.push(
      'dialogue text must contain spoken words only; physical performance belongs in action',
    );
  }
  if (actionLines < Math.ceil(draft.dialogue.length / 2)) {
    reasons.push('at least half the dialogue must have a playable reaction or action');
  }
  if (disconnectedLanguage.test(JSON.stringify(draft))) {
    reasons.push('proposal describes randomness instead of a consistent comic mechanism');
  }
  if (genericPerilLines >= Math.ceil(draft.dialogue.length / 2)) {
    reasons.push('dialogue is dominated by generic warnings or peril rather than comic conflict');
  }
  if (words(draft.endingBeat).length < 4) {
    reasons.push('ending needs a concrete visual payoff');
  }

  const scores = {
    clarity: premiseWords.length >= 7 && premiseWords.length <= 38 ? 1 : 0.3,
    comicRule: disconnectedLanguage.test(draft.premise) ? 0.2 : 0.9,
    escalation: draft.dialogue.length >= 4 && actionLines >= 2 ? 0.9 : 0.45,
    visualPayoff: words(draft.endingBeat).length >= 4 ? 0.9 : 0.3,
    castPurpose: speakers.size >= 2 && speakers.size <= 6 ? 0.9 : 0.35,
  };

  return {
    accepted: reasons.length === 0,
    scores,
    reasons,
  };
}
