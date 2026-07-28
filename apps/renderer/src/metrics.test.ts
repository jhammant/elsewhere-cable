import { describe, expect, it } from 'vitest';
import { calculateFrameStats } from './metrics.js';

describe('calculateFrameStats', () => {
  it('returns zeroed metrics for an empty sample', () => {
    expect(calculateFrameStats([])).toEqual({
      averageFps: 0,
      minimumFps: 0,
      p95FrameTimeMs: 0,
      droppedFrames: 0,
      sampleCount: 0,
    });
  });

  it('calculates average FPS and target-relative drops', () => {
    const result = calculateFrameStats([40, 40, 40, 80], 25);
    expect(result.averageFps).toBe(20);
    expect(result.minimumFps).toBe(12.5);
    expect(result.droppedFrames).toBe(1);
    expect(result.sampleCount).toBe(4);
  });
});
