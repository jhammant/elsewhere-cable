import { describe, expect, it } from 'vitest';
import type { SegmentEvent } from '@elsewhere-cable/schemas';
import { compactSpeechTimeline, recoveryTimingTargets } from './timeline-recovery.js';

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
    const events = [speech(540, 2_000, 0), speech(2_630, 1_800, 1)];

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
});
