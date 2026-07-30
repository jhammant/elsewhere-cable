import type { SegmentEvent, SegmentPackage } from '@elsewhere-cable/schemas';

type Pacing = NonNullable<SegmentPackage['pacing']>;

interface Shift {
  boundaryMs: number;
  reductionMs: number;
}

export const recoveryTimingTargets: Record<
  Pacing,
  { firstSpeechMs: number; dialogueGapMs: number; tailMs: number }
> = {
  frantic: { firstSpeechMs: 540, dialogueGapMs: 90, tailMs: 1_120 },
  staccato: { firstSpeechMs: 820, dialogueGapMs: 280, tailMs: 1_320 },
  conversational: { firstSpeechMs: 1_000, dialogueGapMs: 420, tailMs: 1_220 },
  slow_burn: { firstSpeechMs: 1_200, dialogueGapMs: 900, tailMs: 1_800 },
  interrupted: { firstSpeechMs: 770, dialogueGapMs: 360, tailMs: 1_120 },
  near_silent: { firstSpeechMs: 1_400, dialogueGapMs: 1_000, tailMs: 2_200 },
};

function shiftedTime(atMs: number, shifts: readonly Shift[]): number {
  return (
    atMs -
    shifts.reduce((total, shift) => total + (atMs >= shift.boundaryMs ? shift.reductionMs : 0), 0)
  );
}

export function compactSpeechTimeline(
  events: readonly SegmentEvent[],
  pacing: Pacing,
): {
  events: SegmentEvent[];
  removedDurationMs: number;
  tightenedGapCount: number;
  leadReductionMs: number;
} {
  const speech = events
    .filter(
      (event): event is Extract<SegmentEvent, { type: 'speech.play' }> =>
        event.type === 'speech.play',
    )
    .sort((left, right) => left.atMs - right.atMs);
  const firstSpeech = speech[0];
  if (firstSpeech === undefined) {
    return {
      events: [...events],
      removedDurationMs: 0,
      tightenedGapCount: 0,
      leadReductionMs: 0,
    };
  }

  const target = recoveryTimingTargets[pacing];
  const shifts: Shift[] = [];
  const leadReductionMs = Math.max(0, firstSpeech.atMs - target.firstSpeechMs);
  if (leadReductionMs > 0) {
    shifts.push({ boundaryMs: firstSpeech.atMs, reductionMs: leadReductionMs });
  }
  let tightenedGapCount = 0;
  for (let index = 1; index < speech.length; index += 1) {
    const previous = speech[index - 1]!;
    const current = speech[index]!;
    const gapMs = current.atMs - (previous.atMs + previous.durationMs);
    if (gapMs <= target.dialogueGapMs) {
      continue;
    }
    shifts.push({
      boundaryMs: Math.max(previous.atMs + previous.durationMs + 180, current.atMs - 200),
      reductionMs: gapMs - target.dialogueGapMs,
    });
    tightenedGapCount += 1;
  }

  const removedDurationMs = shifts.reduce((total, shift) => total + shift.reductionMs, 0);
  return {
    events: events
      .map((event) => ({ ...event, atMs: shiftedTime(event.atMs, shifts) }))
      .sort((left, right) => left.atMs - right.atMs),
    removedDurationMs,
    tightenedGapCount,
    leadReductionMs,
  };
}

function lastEventIndex(
  events: readonly SegmentEvent[],
  predicate: (event: SegmentEvent) => boolean,
): number {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (predicate(events[index]!)) {
      return index;
    }
  }
  return -1;
}

export function compactRecoverySegment(
  segment: SegmentPackage,
  pacing: Pacing,
): {
  segment: SegmentPackage;
  timelineDurationRemovedMs: number;
  speechGapsTightened: number;
  leadDurationRemovedMs: number;
  tailDurationRemovedMs: number;
} {
  const compacted = compactSpeechTimeline(segment.events, pacing);
  const speechEvents = compacted.events.filter((event) => event.type === 'speech.play');
  const lastSpeechEndMs = speechEvents.reduce(
    (latest, event) => Math.max(latest, event.atMs + event.durationMs),
    0,
  );
  if (lastSpeechEndMs === 0) {
    return {
      segment: { ...segment, pacing },
      timelineDurationRemovedMs: 0,
      speechGapsTightened: 0,
      leadDurationRemovedMs: 0,
      tailDurationRemovedMs: 0,
    };
  }

  const speechCompactedDurationMs = segment.durationMs - compacted.removedDurationMs;
  const desiredDurationMs = Math.max(
    8_000,
    lastSpeechEndMs + recoveryTimingTargets[pacing].tailMs,
  );
  const nextDurationMs = Math.min(speechCompactedDurationMs, desiredDurationMs);
  const tailDurationRemovedMs = speechCompactedDurationMs - nextDurationMs;
  const endingGraphicIndex = lastEventIndex(
    compacted.events,
    (event) =>
      event.type === 'graphic.show' &&
      event.graphic === 'WARNING' &&
      event.atMs >= lastSpeechEndMs,
  );
  const endingTransitionIndex = lastEventIndex(
    compacted.events,
    (event) => event.type === 'transition.play' && event.atMs >= lastSpeechEndMs,
  );
  const latestEventMs = nextDurationMs - 20;
  const nextEvents = compacted.events
    .map((event, index): SegmentEvent => {
      let atMs = event.atMs;
      if (index === endingGraphicIndex) {
        atMs = Math.min(atMs, lastSpeechEndMs + 120);
      }
      if (index === endingTransitionIndex) {
        atMs = Math.min(atMs, nextDurationMs - 520);
      }
      return { ...event, atMs: Math.max(0, Math.min(atMs, latestEventMs)) };
    })
    .sort((left, right) => left.atMs - right.atMs);

  return {
    segment: {
      ...segment,
      pacing,
      durationMs: nextDurationMs,
      events: nextEvents,
      suggestedExit: {
        ...segment.suggestedExit,
        earliestMs: Math.max(0, nextDurationMs - 1_000),
        preferredMs: nextDurationMs,
      },
    },
    timelineDurationRemovedMs: segment.durationMs - nextDurationMs,
    speechGapsTightened: compacted.tightenedGapCount,
    leadDurationRemovedMs: compacted.leadReductionMs,
    tailDurationRemovedMs,
  };
}
