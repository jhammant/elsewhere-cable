import type {
  GeneratedSegmentDraft,
  GeneratedSegmentProposal,
  SegmentPackage,
} from '@elsewhere-cable/schemas';

export interface CreativeRecord {
  title: string;
  premise: string;
  dialogue: string[];
}

function normalise(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function shingles(value: string, width = 3): Set<string> {
  const words = normalise(value).split(' ').filter(Boolean);
  if (words.length < width) {
    return new Set([words.join(' ')]);
  }
  return new Set(
    words
      .slice(0, words.length - width + 1)
      .map((_, index) => words.slice(index, index + width).join(' ')),
  );
}

function similarity(left: string, right: string): number {
  const leftSet = shingles(left);
  const rightSet = shingles(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) {
      intersection += 1;
    }
  }
  return intersection / union.size;
}

function sharedPhrase(left: string, right: string, width = 5): string | null {
  const rightPhrases = shingles(right, width);
  for (const phrase of shingles(left, width)) {
    if (rightPhrases.has(phrase)) {
      return phrase;
    }
  }
  return null;
}

export function recordFromDraft(draft: GeneratedSegmentDraft): CreativeRecord {
  return {
    title: draft.programmeTitle,
    premise: draft.premise,
    dialogue: draft.dialogue.map((line) => line.text),
  };
}

export function recordFromSegment(segment: SegmentPackage): CreativeRecord {
  return {
    title: segment.programme.title,
    premise: segment.programme.premise,
    dialogue: segment.events
      .filter((event) => event.type === 'speech.play')
      .map((event) => event.subtitle),
  };
}

export function noveltyIssues(
  draft: GeneratedSegmentDraft,
  history: readonly CreativeRecord[],
): string[] {
  return [
    ...conceptNoveltyIssues(draft, history),
    ...dialogueNoveltyIssues(draft.dialogue, history),
  ];
}

export function conceptNoveltyIssues(
  proposal: Pick<GeneratedSegmentProposal, 'programmeTitle' | 'premise'>,
  history: readonly CreativeRecord[],
): string[] {
  const issues: string[] = [];
  const title = normalise(proposal.programmeTitle);
  const premise = normalise(proposal.premise);
  // A large reservoir inevitably shares short connective phrases. At catalogue
  // scale, retain exact and semantic checks while requiring a longer verbatim
  // phrase before rejecting an otherwise distinct physical comedy mechanism.
  const sharedPhraseWidth = history.length > 192 ? 8 : 5;

  for (const previous of history) {
    if (title === normalise(previous.title)) {
      issues.push(`title repeats "${previous.title}"`);
    }
    if (premise === normalise(previous.premise) || similarity(premise, previous.premise) >= 0.7) {
      issues.push(`premise resembles "${previous.premise}"`);
    }
    const repeatedPhrase = sharedPhrase(premise, previous.premise, sharedPhraseWidth);
    if (repeatedPhrase !== null) {
      issues.push(`premise reuses the phrase "${repeatedPhrase}"`);
    }
  }

  return [...new Set(issues)];
}

export function dialogueNoveltyIssues(
  dialogue: readonly { text: string }[],
  history: readonly CreativeRecord[],
): string[] {
  const issues: string[] = [];
  const lines = dialogue.map((line) => normalise(line.text));

  for (const previous of history) {
    for (const line of lines) {
      for (const previousLine of previous.dialogue) {
        if (
          line === normalise(previousLine) ||
          (line.split(' ').length >= 6 && similarity(line, previousLine) >= 0.76)
        ) {
          issues.push(`dialogue resembles "${previousLine}"`);
        }
      }
    }
  }

  return [...new Set(issues)];
}
