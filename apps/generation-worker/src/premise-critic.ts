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

export function hasGoalDirectedConflict(premise: string): boolean {
  return (
    /\b(?:apologis(?:e|es|ed|ing)|appeal(?:s|ed|ing)?|appl(?:y|ies|ied|ying)|argu(?:e|es|ed|ing)|ask(?:s|ed|ing)?|auction(?:s|ed|ing)?|bring(?:s|ing)?|call(?:s|ed|ing)?|collect(?:s|ed|ing)?|compete(?:s|d|ing)?|conduct(?:s|ed|ing)?|deliver(?:s|ed|ing)?|discover(?:s|ed|ing)?|dispute(?:s|d|ing)?|excavat(?:e|es|ed|ing)|explain(?:s|ed|ing)?|follow(?:s|ed|ing)?|gives?\s+(?:live\s+)?evidence|investigat(?:e|es|ed|ing)|insist(?:s|ed|ing)?|locat(?:e|es|ed|ing)|order(?:s|ed|ing)?|practis(?:e|es|ed|ing)|predict(?:s|ed|ing)?|prevent(?:s|ed|ing)?|prosecut(?:e|es|ed|ing)|protect(?:s|ed|ing)?|refus(?:e|es|ed|ing)|report(?:s|ed|ing)?|return(?:s|ed|ing)?|schedul(?:e|es|ed|ing)|seek(?:s|ing)?|sell(?:s|ing)?|trac(?:e|es|ed|ing)|transport(?:s|ed|ing)?|tr(?:y|ies|ied|ying)|want(?:s|ed|ing)?|warn(?:s|ed|ing)?)\b/iu.test(
      premise,
    ) ||
    /\b(?:announcer|caller|character|clerk|customer|employee|guest|host|official|owner|presenter|programme|relative|reporter|resident|scheduler|spokesperson|worker)\b.{0,50}\b(?:attempts?|demands?|hopes?|must|needs?|plans?|requires?)\b/iu.test(
      premise,
    )
  );
}

const endingMechanisms = [
  { name: 'becoming something else', pattern: /\bbecom(?:e|es|ing)\b/iu },
  { name: 'detaching', pattern: /\bdetach(?:es|ed|ing)?\b/iu },
  { name: 'disappearing', pattern: /\bdisappear(?:s|ed|ing)?\b/iu },
  { name: 'expanding', pattern: /\bexpand(?:s|ed|ing)?\b/iu },
  { name: 'exploding', pattern: /\bexplod(?:e|es|ed|ing)\b/iu },
  {
    name: 'being consumed',
    pattern: /\b(?:consum(?:e|es|ed|ing)|eat(?:s|en|ing)?|swallow(?:s|ed|ing)?)\b/iu,
  },
  { name: 'flattening', pattern: /\bflatten(?:s|ed|ing)?\b/iu },
  {
    name: 'freezing in place',
    pattern: /\b(?:freez(?:e|es|ing)|frozen)\s+(?:in\s+place|mid(?:-| )\w+)\b/iu,
  },
  { name: 'growing', pattern: /\bgrow(?:s|ing)?\b|\bgrew\b/iu },
  { name: 'melting', pattern: /\bmelt(?:s|ed|ing)?\b/iu },
  { name: 'rotating', pattern: /\brotat(?:e|es|ed|ing)\b/iu },
  { name: 'rippling', pattern: /\brippl(?:e|es|ed|ing)\b/iu },
  { name: 'shrinking', pattern: /\bshrink(?:s|ing)?\b|\bshrank\b/iu },
  { name: 'splitting', pattern: /\bsplit(?:s|ting)?\b/iu },
  { name: 'swapping', pattern: /\bswap(?:s|ped|ping)?\b/iu },
  { name: 'transforming', pattern: /\btransform(?:s|ed|ing)?\b/iu },
  { name: 'turning into something else', pattern: /\bturn(?:s|ed|ing)?\s+into\b/iu },
  { name: 'vanishing', pattern: /\bvanish(?:es|ed|ing)?\b/iu },
  { name: 'dissolving', pattern: /\bdissolv(?:e|es|ed|ing)\b/iu },
] as const;

export function unearnedEndingMechanisms(premise: string, endingBeat: string): string[] {
  return endingMechanisms
    .filter(({ pattern }) => pattern.test(endingBeat) && !pattern.test(premise))
    .map(({ name }) => name);
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
  const ruleExpositionLines = draft.dialogue.filter((line) =>
    /\b(?:the rule|rule is|the law|law takes effect|contract terms|forces? (?:me|you|them|the)|is absolute|regardless of our feelings)\b/iu.test(
      line.text,
    ),
  ).length;
  const unearnedTragedy =
    /\b(?:childhood trauma|tragic backstory|orphanage fire|parents? died|dead family|terminal illness)\b/iu.test(
      JSON.stringify(draft),
    );
  const highStakesEmergency =
    draft.format === 'emergency' &&
    /\b(?:catastroph\w*|collaps\w*|evacuat\w*|extinction|life[- ]threatening|mass casualty|surviv\w*|star system.{0,24}dissolv\w*|planet.{0,24}destroy\w*)\b/iu.test(
      JSON.stringify(draft),
    );
  const genericFearEnding =
    /\b(?:in horror|panic(?:s|ked|king)?|scream(?:s|ed|ing)?|stares? in horror|terrified|trembl(?:e|es|ed|ing))\b/iu.test(
      draft.endingBeat,
    );
  const stageDirectionLines = draft.dialogue.filter((line) =>
    containsSpokenStageDirection(line.text),
  ).length;
  const pacing = draft.pacing ?? 'conversational';
  const pacingRanges = {
    frantic: [10, 12],
    staccato: [8, 12],
    conversational: [6, 10],
    slow_burn: [6, 8],
    interrupted: [4, 8],
    near_silent: [4, 6],
  } as const;
  const [minimumDialogueBeats, maximumDialogueBeats] = pacingRanges[pacing];

  if (draft.channelName.trim().toLowerCase() === 'elsewhere cable') {
    reasons.push('Elsewhere Cable is the network identity and cannot be a channel name');
  }
  if (premiseWords.length < 8 || premiseWords.length > 48) {
    reasons.push('premise must state one legible comic rule in 8–48 words');
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
  if (actionLines < Math.ceil(draft.dialogue.length * 0.75)) {
    reasons.push('at least three quarters of dialogue must have a playable reaction or action');
  }
  if (disconnectedLanguage.test(JSON.stringify(draft))) {
    reasons.push('proposal describes randomness instead of a consistent comic mechanism');
  }
  if (/\(\s*\d+\s+words?\s*\)/iu.test(JSON.stringify(draft))) {
    reasons.push('segment contains a model annotation instead of programme content');
  }
  if (!hasGoalDirectedConflict(draft.premise)) {
    reasons.push('premise must make a specific character goal or refusal explicit');
  }
  if (genericPerilLines >= Math.ceil(draft.dialogue.length / 2)) {
    reasons.push('dialogue is dominated by generic warnings or peril rather than comic conflict');
  }
  if (ruleExpositionLines >= 2) {
    reasons.push('characters explain the rule instead of pursuing conflicting goals inside it');
  }
  if (unearnedTragedy) {
    reasons.push('segment uses unearned tragedy as a shortcut for comic stakes');
  }
  if (highStakesEmergency) {
    reasons.push('emergency comedy must use harmless administrative stakes, not catastrophe');
  }
  if (genericFearEnding) {
    reasons.push('ending defaults to generic fear instead of a comic decision or status reversal');
  }
  if (
    draft.storyMode !== undefined &&
    (draft.dialogue.length < minimumDialogueBeats || draft.dialogue.length > maximumDialogueBeats)
  ) {
    reasons.push(
      `${pacing} pacing requires ${minimumDialogueBeats}–${maximumDialogueBeats} dialogue beats`,
    );
  }
  if (words(draft.endingBeat).length < 4) {
    reasons.push('ending needs a concrete visual payoff');
  }
  const introducedEndingMechanisms = unearnedEndingMechanisms(draft.premise, draft.endingBeat);
  if (introducedEndingMechanisms.length > 0) {
    reasons.push(
      `ending introduces unearned mechanisms absent from the premise: ${introducedEndingMechanisms.join(', ')}`,
    );
  }

  const scores = {
    clarity: premiseWords.length >= 8 && premiseWords.length <= 48 ? 1 : 0.3,
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
