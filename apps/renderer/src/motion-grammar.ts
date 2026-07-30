import type { SegmentPackage } from '@elsewhere-cable/schemas';

export type PacingMode = NonNullable<SegmentPackage['pacing']>;

export interface PacingMotionFrame {
  cameraX: number;
  cameraY: number;
  zoom: number;
  actorBob: number;
  actorSway: number;
  propX: number;
  propY: number;
  graphicPulse: number;
}

function phaseOffset(seed: number): number {
  return (Math.abs(seed) % 1) * Math.PI * 2;
}

function steppedNoise(step: number, seed: number): number {
  const value = Math.sin((step + 1) * 12.9898 + seed * 78.233) * 43_758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function pacingMotionFrame(
  pacing: PacingMode,
  elapsedSeconds: number,
  seed = 0,
): PacingMotionFrame {
  const elapsed = Math.max(0, elapsedSeconds);
  const phase = phaseOffset(seed);

  if (pacing === 'frantic') {
    const editStep = Math.floor(elapsed * 4);
    const jolt = steppedNoise(editStep, seed);
    return {
      cameraX: jolt * 10 + Math.sin(elapsed * 9 + phase) * 4,
      cameraY: steppedNoise(editStep + 17, seed) * 5,
      zoom: 1.006 + Math.max(0, Math.sin(elapsed * 5 + phase)) * 0.007,
      actorBob: Math.sin(elapsed * 11 + phase) * 15,
      actorSway: Math.sin(elapsed * 7 + phase) * 10,
      propX: Math.sin(elapsed * 3.2 + phase) * 18,
      propY: Math.cos(elapsed * 4.1 + phase) * 10,
      graphicPulse: 0.45 + Math.max(0, Math.sin(elapsed * 8 + phase)) * 0.55,
    };
  }

  if (pacing === 'staccato') {
    const beat = Math.floor(elapsed * 2.4);
    const alternate = beat % 2 === 0 ? -1 : 1;
    return {
      cameraX: steppedNoise(beat, seed) * 7,
      cameraY: alternate * 3,
      zoom: beat % 4 === 0 ? 1.012 : 1.003,
      actorBob: alternate * 7,
      actorSway: steppedNoise(beat + 31, seed) * 5,
      propX: alternate * 9,
      propY: beat % 3 === 0 ? -6 : 2,
      graphicPulse: beat % 3 === 0 ? 1 : 0.28,
    };
  }

  if (pacing === 'interrupted') {
    const cycle = (elapsed + seed * 3.7) % 3.8;
    const interruption = cycle < 0.34 ? Math.sin((cycle / 0.34) * Math.PI) : 0;
    return {
      cameraX: interruption * 15 + Math.sin(elapsed * 0.7 + phase) * 2,
      cameraY: -interruption * 5,
      zoom: 1.003 + interruption * 0.012,
      actorBob: Math.sin(elapsed * 1.5 + phase) * 4 + interruption * 9,
      actorSway: interruption * 11,
      propX: interruption * -14,
      propY: Math.sin(elapsed * 0.9 + phase) * 4,
      graphicPulse: interruption,
    };
  }

  if (pacing === 'slow_burn') {
    return {
      cameraX: Math.sin(elapsed * 0.27 + phase) * 6,
      cameraY: Math.cos(elapsed * 0.19 + phase) * 3,
      zoom: 1.004 + (Math.sin(elapsed * 0.18 + phase) + 1) * 0.005,
      actorBob: Math.sin(elapsed * 0.75 + phase) * 3,
      actorSway: Math.sin(elapsed * 0.42 + phase) * 2,
      propX: Math.sin(elapsed * 0.31 + phase) * 10,
      propY: Math.cos(elapsed * 0.44 + phase) * 5,
      graphicPulse: 0.34 + (Math.sin(elapsed * 0.24 + phase) + 1) * 0.18,
    };
  }

  if (pacing === 'near_silent') {
    return {
      cameraX: Math.sin(elapsed * 0.2 + phase) * 5,
      cameraY: Math.cos(elapsed * 0.16 + phase) * 4,
      zoom: 1.005 + (Math.sin(elapsed * 0.13 + phase) + 1) * 0.006,
      actorBob: Math.sin(elapsed * 0.62 + phase) * 2.5,
      actorSway: Math.sin(elapsed * 0.28 + phase) * 2,
      propX: Math.sin(elapsed * 0.24 + phase) * 7,
      propY: Math.cos(elapsed * 0.3 + phase) * 8,
      graphicPulse: 0.2 + (Math.sin(elapsed * 0.2 + phase) + 1) * 0.16,
    };
  }

  return {
    cameraX: Math.sin(elapsed * 0.52 + phase) * 3,
    cameraY: Math.cos(elapsed * 0.41 + phase) * 2,
    zoom: 1.003 + (Math.sin(elapsed * 0.3 + phase) + 1) * 0.002,
    actorBob: Math.sin(elapsed * 1.25 + phase) * 4,
    actorSway: Math.sin(elapsed * 0.83 + phase) * 3,
    propX: Math.sin(elapsed * 0.58 + phase) * 5,
    propY: Math.cos(elapsed * 0.7 + phase) * 3,
    graphicPulse: 0.28 + (Math.sin(elapsed * 0.65 + phase) + 1) * 0.14,
  };
}
