import { describe, expect, it } from 'vitest';
import type { ScheduledSoundCue } from './sound-design.js';
import { storyCueMotion } from './story-cue-motion.js';

function cue(sound: ScheduledSoundCue['cue'], durationMs = 200): ScheduledSoundCue {
  return {
    atMs: 0,
    cue: sound,
    durationMs,
    gain: 0.02,
    seed: 42,
    reason: 'spoken-prop',
  };
}

describe('storyCueMotion', () => {
  it('returns the exact identity transform before and after a cue', () => {
    expect(storyCueMotion(cue('bell'), -1)).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      flash: 0,
    });
    expect(storyCueMotion(cue('bell'), 200)).toEqual(storyCueMotion(null, 100));
  });

  it('gives different physical vocabularies to rings, knocks and paper', () => {
    const bell = storyCueMotion(cue('bell'), 70);
    const knock = storyCueMotion(cue('knock'), 70);
    const paper = storyCueMotion(cue('paper_rustle'), 70);

    expect(bell.y).toBeLessThan(-5);
    expect(Math.abs(knock.x)).toBeGreaterThan(3);
    expect(paper).not.toEqual(bell);
    expect(paper).not.toEqual(knock);
  });

  it('keeps seeded jitter deterministic', () => {
    const scheduled = cue('teletype', 230);
    expect(storyCueMotion(scheduled, 91)).toEqual(storyCueMotion(scheduled, 91));
  });

  it('keeps every supported cue finite and bounded', () => {
    const sounds: ScheduledSoundCue['cue'][] = [
      'advisory_chime',
      'applause',
      'bell',
      'bureaucratic_stamp',
      'buzzer',
      'cash_register',
      'clink',
      'cloud_hatch',
      'continuity_blip',
      'domestic_sting',
      'freezer_latch',
      'knock',
      'mechanical_click',
      'paper_rustle',
      'phone_chirp',
      'teletype',
      'tick',
      'tuning',
      'vhs_click',
      'wood_tap',
    ];

    for (const sound of sounds) {
      for (const seed of [0, 1, 42, 1_000_003, 0xffffffff]) {
        for (const elapsedMs of [0, 20, 50, 80, 120, 160, 199]) {
          const scheduled = { ...cue(sound), seed };
          const motion = storyCueMotion(scheduled, elapsedMs);
          for (const value of Object.values(motion)) {
            expect(Number.isFinite(value), `${sound}:${seed}:${elapsedMs}`).toBe(true);
          }
          expect(Math.abs(motion.x), sound).toBeLessThanOrEqual(24);
          expect(Math.abs(motion.y), sound).toBeLessThanOrEqual(20);
          expect(Math.abs(motion.rotation), sound).toBeLessThanOrEqual(0.1);
          expect(motion.scaleX, sound).toBeGreaterThan(0.85);
          expect(motion.scaleX, sound).toBeLessThan(1.2);
          expect(motion.scaleY, sound).toBeGreaterThan(0.85);
          expect(motion.scaleY, sound).toBeLessThan(1.2);
        }
      }
    }
  });
});
