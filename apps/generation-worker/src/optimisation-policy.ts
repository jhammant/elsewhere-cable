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
  'your',
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
      words.filter((word) => !motifStopWords.has(word)).length < 2
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
          window.filter((word) => !motifStopWords.has(word)).length < 2 ||
          motifStopWords.has(window[0]!) ||
          motifStopWords.has(window.at(-1)!)
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
