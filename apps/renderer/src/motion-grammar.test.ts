import { describe, expect, it } from 'vitest';
import { pacingMotionFrame, type PacingMode } from './motion-grammar.js';

const pacingModes: PacingMode[] = [
  'frantic',
  'staccato',
  'conversational',
  'slow_burn',
  'interrupted',
  'near_silent',
];

describe('pacing motion grammar', () => {
  it('keeps every camera move inside the programme safe plane', () => {
    for (const pacing of pacingModes) {
      for (let frame = 0; frame <= 600; frame += 1) {
        const motion = pacingMotionFrame(pacing, frame / 25, 0.417);
        expect(Math.abs(motion.cameraX)).toBeLessThanOrEqual(18);
        expect(Math.abs(motion.cameraY)).toBeLessThanOrEqual(8);
        expect(motion.zoom).toBeGreaterThanOrEqual(1);
        expect(motion.zoom).toBeLessThanOrEqual(1.02);
        expect(motion.graphicPulse).toBeGreaterThanOrEqual(0);
        expect(motion.graphicPulse).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every pacing mode a distinct motion fingerprint', () => {
    const fingerprints = pacingModes.map((pacing) =>
      [0.4, 1.3, 3.7, 7.1]
        .flatMap((elapsed) => {
          const motion = pacingMotionFrame(pacing, elapsed, 0.281);
          return [
            motion.cameraX,
            motion.cameraY,
            motion.zoom,
            motion.actorBob,
            motion.propX,
            motion.graphicPulse,
          ];
        })
        .map((value) => value.toFixed(3))
        .join(':'),
    );

    expect(new Set(fingerprints).size).toBe(pacingModes.length);
  });

  it('keeps quiet pacing alive while making frantic pacing more energetic', () => {
    const activity = (pacing: PacingMode): number =>
      Array.from({ length: 50 }, (_, index) => {
        const motion = pacingMotionFrame(pacing, index / 5, 0.733);
        return (
          Math.abs(motion.cameraX) +
          Math.abs(motion.cameraY) +
          Math.abs(motion.actorBob) +
          Math.abs(motion.actorSway) +
          Math.abs(motion.propX) +
          Math.abs(motion.propY)
        );
      }).reduce((total, value) => total + value, 0);

    expect(activity('near_silent')).toBeGreaterThan(0);
    expect(activity('frantic')).toBeGreaterThan(activity('slow_burn') * 2);
  });

  it('creates a brief interruption jolt followed by a calmer hold', () => {
    const seed = 0;
    const jolt = pacingMotionFrame('interrupted', 0.17, seed);
    const hold = pacingMotionFrame('interrupted', 1.4, seed);

    expect(Math.abs(jolt.cameraX)).toBeGreaterThan(Math.abs(hold.cameraX) * 3);
    expect(jolt.graphicPulse).toBeGreaterThan(hold.graphicPulse);
  });
});
