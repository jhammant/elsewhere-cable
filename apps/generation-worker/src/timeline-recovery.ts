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
  frantic: { firstSpeechMs: 400, dialogueGapMs: 80, tailMs: 600 },
  staccato: { firstSpeechMs: 500, dialogueGapMs: 160, tailMs: 750 },
  conversational: { firstSpeechMs: 550, dialogueGapMs: 220, tailMs: 700 },
  slow_burn: { firstSpeechMs: 1_200, dialogueGapMs: 900, tailMs: 1_800 },
  interrupted: { firstSpeechMs: 500, dialogueGapMs: 180, tailMs: 700 },
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

export function eventsWithinDuration(
  events: readonly SegmentEvent[],
  durationMs: number,
): SegmentEvent[] {
  const latestEventMs = Math.max(0, durationMs - 20);
  return events
    .filter((event) => event.atMs <= latestEventMs)
    .sort((left, right) => left.atMs - right.atMs);
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
  const desiredDurationMs = Math.max(5_200, lastSpeechEndMs + recoveryTimingTargets[pacing].tailMs);
  const nextDurationMs = Math.min(speechCompactedDurationMs, desiredDurationMs);
  const tailDurationRemovedMs = speechCompactedDurationMs - nextDurationMs;
  const endingGraphicIndex = lastEventIndex(
    compacted.events,
    (event) =>
      event.type === 'graphic.show' && event.graphic === 'WARNING' && event.atMs >= lastSpeechEndMs,
  );
  const endingTransitionIndex = lastEventIndex(
    compacted.events,
    (event) => event.type === 'transition.play' && event.atMs >= lastSpeechEndMs,
  );
  const nextEvents = eventsWithinDuration(
    compacted.events.map((event, index): SegmentEvent => {
      let atMs = event.atMs;
      if (index === endingGraphicIndex) {
        atMs = Math.min(atMs, lastSpeechEndMs + 120);
      }
      if (index === endingTransitionIndex) {
        atMs = Math.min(atMs, nextDurationMs - 520);
      }
      return { ...event, atMs: Math.max(0, atMs) };
    }),
    nextDurationMs,
  );

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
