export const pacingModes = [
  'frantic',
  'staccato',
  'conversational',
  'slow_burn',
  'interrupted',
  'near_silent',
] as const;

export type PacingMode = (typeof pacingModes)[number];

interface DeliveryPacingSignal {
  silenceRatio: number | null;
  freezeRatio: number | null;
}

interface DiversityDescriptor {
  programmeTitle: string;
  format: string;
  visualMedium: string;
  castArchetype: string;
  pacing: string;
}

export interface WindowDiversityMetrics {
  uniqueProgrammes: number;
  programmeRepeats: number;
  programmeUniquenessRatio: number;
  uniqueFormats: number;
  uniqueVisualMedia: number;
  uniqueCastArchetypes: number;
  uniquePacingModes: number;
}

const motifStopWords = new Set([
  'and',
  'about',
  'after',
  'again',
  'against',
  'back',
  'before',
  'being',
  'between',
  'broadcast',
  'character',
  'deliver',
  'during',
  'every',
  'first',
  'for',
  'from',
  'has',
  'have',
  'host',
  'into',
  'its',
  'made',
  'not',
  'original',
  'own',
  'presenter',
  'programme',
  'resident',
  'service',
  'show',
  'studio',
  'the',
  'their',
  'them',
  'there',
  'these',
  'they',
  'thing',
  'this',
  'three',
  'through',
  'until',
  'voice',
  'when',
  'where',
  'which',
  'while',
  'whose',
  'with',
  'yet',
  'your',
  'conduct',
]);

function motifWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z]{3,}/gu) ?? [];
}

export function concreteMotifPhrases(values: readonly string[]): string[] {
  const accepted: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const words = motifWords(value);
    if (
      words.length < 2 ||
      words.length > 5 ||
      words.some((word) => motifStopWords.has(word)) ||
      new Set(words).size !== words.length
    ) {
      continue;
    }
    const phrase = words.join(' ');
    if (!seen.has(phrase)) {
      seen.add(phrase);
      accepted.push(phrase);
    }
  }
  return accepted;
}

export function repeatedStoryPhrases(texts: readonly string[], maximum = 8): string[] {
  const frequencies = new Map<string, number>();
  for (const text of texts) {
    const words = motifWords(text);
    const seenInText = new Set<string>();
    for (const size of [3, 2]) {
      for (let index = 0; index <= words.length - size; index += 1) {
        const window = words.slice(index, index + size);
        if (
          window.some((word) => motifStopWords.has(word)) ||
          new Set(window).size !== window.length
        ) {
          continue;
        }
        seenInText.add(window.join(' '));
      }
    }
    for (const phrase of seenInText) {
      frequencies.set(phrase, (frequencies.get(phrase) ?? 0) + 1);
    }
  }
  return [...frequencies.entries()]
    .filter(([, count]) => count >= 2)
    .sort(
      (left, right) =>
        right[1] - left[1] ||
        right[0].split(' ').length - left[0].split(' ').length ||
        left[0].localeCompare(right[0]),
    )
    .reduce<string[]>((selected, [phrase]) => {
      if (selected.length >= maximum) {
        return selected;
      }
      const words = new Set(phrase.split(' '));
      const overlapsExistingPhrase = selected.some((existing) => {
        const existingWords = existing.split(' ');
        const sharedWords = existingWords.filter((word) => words.has(word)).length;
        return sharedWords >= Math.min(2, words.size, existingWords.length);
      });
      if (!overlapsExistingPhrase) {
        selected.push(phrase);
      }
      return selected;
    }, []);
}

export function deliveryNeedsCorrection(delivery: DeliveryPacingSignal): boolean {
  return (
    (delivery.silenceRatio !== null && delivery.silenceRatio >= 0.12) ||
    (delivery.freezeRatio !== null && delivery.freezeRatio >= 0.18)
  );
}

export function pacingCandidatesForDelivery(delivery: DeliveryPacingSignal): readonly PacingMode[] {
  if (deliveryNeedsCorrection(delivery)) {
    return ['frantic', 'staccato', 'interrupted'];
  }
  return pacingModes;
}

export function deliveryPacingDirection(delivery: DeliveryPacingSignal): string | null {
  if (deliveryNeedsCorrection(delivery)) {
    return 'Reduce prolonged silence and static holds; favour visible action, frequent shot changes and continuous audible presence.';
  }
  return null;
}

export function windowDiversityMetrics(
  descriptors: readonly DiversityDescriptor[],
): WindowDiversityMetrics {
  const uniqueCount = (select: (value: DiversityDescriptor) => string): number =>
    new Set(descriptors.map(select)).size;
  const uniqueProgrammes = uniqueCount((value) => value.programmeTitle);
  return {
    uniqueProgrammes,
    programmeRepeats: Math.max(0, descriptors.length - uniqueProgrammes),
    programmeUniquenessRatio: descriptors.length === 0 ? 0 : uniqueProgrammes / descriptors.length,
    uniqueFormats: uniqueCount((value) => value.format),
    uniqueVisualMedia: uniqueCount((value) => value.visualMedium),
    uniqueCastArchetypes: uniqueCount((value) => value.castArchetype),
    uniquePacingModes: uniqueCount((value) => value.pacing),
  };
}

export function programmeUniquenessScore(
  metrics: Pick<WindowDiversityMetrics, 'programmeUniquenessRatio'>,
): number {
  return Math.max(0, Math.min(10, Math.round(metrics.programmeUniquenessRatio * 10)));
}

export function categoryDiversityScore(
  values: readonly string[],
  expectedCategoryCount: number,
): number {
  if (values.length === 0 || expectedCategoryCount <= 1) {
    return 0;
  }
  const frequencies = new Map<string, number>();
  for (const value of values) {
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  }
  const entropy = [...frequencies.values()].reduce((total, count) => {
    const probability = count / values.length;
    return total - probability * Math.log(probability);
  }, 0);
  return Math.max(0, Math.min(10, Math.round((entropy / Math.log(expectedCategoryCount)) * 10)));
}
