import { describe, expect, it } from 'vitest';
import type { SegmentEvent, SegmentPackage } from '@elsewhere-cable/schemas';
import {
  compactRecoverySegment,
  compactSpeechTimeline,
  eventsWithinDuration,
  recoveryTimingTargets,
} from './timeline-recovery.js';

function speech(atMs: number, durationMs: number, index: number): SegmentEvent {
  return {
    atMs,
    type: 'speech.play',
    speechId: `speech_${index}`,
    characterId: `character_${index % 2}`,
    characterName: `Character ${index % 2}`,
    voiceId: `voice_${index % 2}`,
    subtitle: 'A complete spoken comedy line.',
    audioFile: `audio/speech_${index}.wav`,
    durationMs,
  };
}

describe('delivery timeline recovery', () => {
  it('retains deliberate contrast while capping excessive near-silent dead space', () => {
    const events: SegmentEvent[] = [
      { atMs: 300, type: 'camera.cut', camera: 'CAMERA_WIDE' },
      speech(3_320, 2_000, 0),
      speech(8_020, 2_000, 1),
      { atMs: 10_500, type: 'transition.play', transition: 'STATIC_BURST' },
    ];

    const result = compactSpeechTimeline(events, 'near_silent');
    const compactedSpeech = result.events.filter((event) => event.type === 'speech.play');

    expect(compactedSpeech[0]?.atMs).toBe(1_400);
    expect(compactedSpeech[1]?.atMs).toBe(4_400);
    expect(result.leadReductionMs).toBe(1_920);
    expect(result.tightenedGapCount).toBe(1);
    expect(result.removedDurationMs).toBe(3_620);
  });

  it('leaves already compact frantic dialogue unchanged', () => {
    const events = [speech(400, 2_000, 0), speech(2_480, 1_800, 1)];

    expect(compactSpeechTimeline(events, 'frantic')).toEqual({
      events,
      removedDurationMs: 0,
      tightenedGapCount: 0,
      leadReductionMs: 0,
    });
  });

  it('keeps slow and near-silent targets slower than conversational pacing', () => {
    expect(recoveryTimingTargets.slow_burn.dialogueGapMs).toBeGreaterThan(
      recoveryTimingTargets.conversational.dialogueGapMs,
    );
    expect(recoveryTimingTargets.near_silent.tailMs).toBeGreaterThan(
      recoveryTimingTargets.slow_burn.tailMs,
    );
  });

  it('drops late incidental visuals instead of stacking them on a shortened final frame', () => {
    const events: SegmentEvent[] = [
      speech(1_000, 2_000, 0),
      { atMs: 4_500, type: 'transition.play', transition: 'STATIC_BURST' },
      { atMs: 8_500, type: 'camera.cut', camera: 'CAMERA_GUEST' },
    ];

    expect(eventsWithinDuration(events, 5_000)).toEqual(events.slice(0, 2));
  });

  it('turns an approved replay into a continuous energetic presentation without changing speech', () => {
    const source = {
      schemaVersion: 1,
      segmentId: 'seg_recovery_source',
      channel: {
        id: 'channel_9876543210',
        number: 9_876_543_210,
        name: 'Continuity Laboratory',
        realityId: 'REALITY-TEST',
      },
      programme: {
        id: 'the_delayed_reply',
        title: 'The Delayed Reply',
        format: 'public_access',
        premise: 'A presenter and caller negotiate who must answer a harmless question first.',
      },
      durationMs: 20_000,
      visualStyle: 'public_access_1991',
      visualMedium: 'paper_cutout',
      castArchetype: 'paper_puppets',
      pacing: 'near_silent',
      storyMode: 'social_protocol',
      tone: ['dry', 'awkward'],
      events: [
        { atMs: 0, type: 'transition.play', transition: 'FADE_TO_IDENT' },
        speech(3_200, 2_000, 0),
        { atMs: 5_300, type: 'audio.static', durationMs: 120 },
        speech(8_000, 2_000, 1),
        { atMs: 18_000, type: 'transition.play', transition: 'STATIC_BURST' },
      ],
      continuityUpdates: [],
      suggestedExit: {
        earliestMs: 18_000,
        preferredMs: 19_000,
        transition: 'STATIC_BURST',
      },
      production: {
        generatedAt: '2026-07-30T00:00:00.000Z',
        generator: 'demo-library',
        model: 'hand-authored-demo',
        safetyStatus: 'approved-for-local-preview',
        audioPrepared: true,
      },
    } satisfies SegmentPackage;

    const result = compactRecoverySegment(source, 'frantic');
    const sourceSpeech = source.events.filter((event) => event.type === 'speech.play');
    const nextSpeech = result.segment.events.filter((event) => event.type === 'speech.play');
    const sourceStatic = source.events.filter((event) => event.type === 'audio.static');
    const nextStatic = result.segment.events.filter((event) => event.type === 'audio.static');

    expect(nextSpeech.map(({ atMs }) => atMs)).toEqual([400, 2_480]);
    expect(nextSpeech).toHaveLength(sourceSpeech.length);
    nextSpeech.forEach((event, index) => {
      expect(event).toEqual({ ...sourceSpeech[index]!, atMs: event.atMs });
    });
    expect(nextStatic).toHaveLength(sourceStatic.length);
    nextStatic.forEach((event, index) => {
      expect(event).toEqual({ ...sourceStatic[index]!, atMs: event.atMs });
    });
    expect(result.segment.pacing).toBe('frantic');
    expect(result.segment.durationMs).toBe(5_200);
    expect(result.timelineDurationRemovedMs).toBe(14_800);
    expect(result.speechGapsTightened).toBe(1);
    expect(result.tailDurationRemovedMs).toBe(9_280);
    expect(result.segment.events.every((event) => event.atMs < result.segment.durationMs)).toBe(
      true,
    );
  });
});
