import type { ScheduledSoundCue } from './sound-design.js';

export interface StoryCueMotion {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  flash: number;
}

const idleStoryCueMotion: StoryCueMotion = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  flash: 0,
};

function deterministicJitter(seed: number, step: number): number {
  let value = (seed + Math.imul(step + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (((value ^ (value >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * Converts a scheduled audible cue into a brief, renderer-neutral prop motion.
 * Returning the identity transform outside the cue makes every prop settle
 * exactly back onto its authored staging.
 */
export function storyCueMotion(
  scheduled: ScheduledSoundCue | null,
  elapsedMs: number,
): StoryCueMotion {
  if (scheduled === null || elapsedMs < 0 || elapsedMs >= scheduled.durationMs) {
    return idleStoryCueMotion;
  }

  const progress = elapsedMs / scheduled.durationMs;
  const envelope = Math.sin(progress * Math.PI);
  const decay = 1 - progress;
  const pulse = Math.sin(progress * Math.PI * 4) * decay;
  switch (scheduled.cue) {
    case 'advisory_chime':
    case 'bell':
    case 'continuity_blip':
    case 'domestic_sting':
    case 'phone_chirp':
      return {
        x: 0,
        y: -18 * envelope,
        rotation: Math.sin(progress * Math.PI * 2) * 0.055,
        scaleX: 1 + envelope * 0.12,
        scaleY: 1 + envelope * 0.12,
        flash: envelope * 0.45,
      };
    case 'applause': {
      const step = Math.floor(progress * 9);
      const jitter = deterministicJitter(scheduled.seed, step);
      return {
        x: jitter * 9 * decay,
        y: -Math.abs(jitter) * 11 * decay,
        rotation: jitter * 0.035 * decay,
        scaleX: 1 + Math.abs(jitter) * 0.045 * decay,
        scaleY: 1 - Math.abs(jitter) * 0.025 * decay,
        flash: envelope * 0.2,
      };
    }
    case 'bureaucratic_stamp':
    case 'buzzer':
    case 'cel_impact':
    case 'knock':
    case 'paper_burst':
    case 'pixel_blast':
    case 'signal_rupture':
    case 'wood_tap':
      return {
        x: pulse * 21,
        y: 0,
        rotation: pulse * 0.09,
        scaleX: 1 + Math.abs(pulse) * 0.035,
        scaleY: 1 - Math.abs(pulse) * 0.025,
        flash: Math.abs(pulse) * 0.18,
      };
    case 'cash_register':
    case 'freezer_latch':
    case 'mechanical_click':
    case 'tick':
    case 'vhs_click':
      return {
        x: pulse * 6,
        y: envelope * 4,
        rotation: pulse * 0.025,
        scaleX: 1 + envelope * 0.09,
        scaleY: 1 - envelope * 0.07,
        flash: envelope * 0.32,
      };
    case 'clink':
      return {
        x: pulse * 7,
        y: -envelope * 9,
        rotation: pulse * 0.07,
        scaleX: 1 + envelope * 0.055,
        scaleY: 1 + envelope * 0.055,
        flash: envelope * 0.38,
      };
    case 'cloud_hatch':
    case 'paper_rustle':
    case 'prism_chime':
    case 'spectrum_sweep':
    case 'teletype':
    case 'tuning': {
      const step = Math.floor(progress * 12);
      const jitter = deterministicJitter(scheduled.seed, step) * decay;
      return {
        x: jitter * 13,
        y: Math.sin(progress * Math.PI * 6) * 5 * decay,
        rotation: jitter * 0.075,
        scaleX: 1 + jitter * 0.025,
        scaleY: 1 - jitter * 0.02,
        flash: Math.abs(jitter) * 0.22,
      };
    }
  }
}
