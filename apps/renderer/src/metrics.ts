export interface FrameStats {
  averageFps: number;
  minimumFps: number;
  p95FrameTimeMs: number;
  droppedFrames: number;
  sampleCount: number;
}

function round(value: number, places = 2): number {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

export function calculateFrameStats(frameTimesMs: readonly number[], targetFps = 25): FrameStats {
  if (frameTimesMs.length === 0) {
    return {
      averageFps: 0,
      minimumFps: 0,
      p95FrameTimeMs: 0,
      droppedFrames: 0,
      sampleCount: 0,
    };
  }

  const sorted = [...frameTimesMs].sort((left, right) => left - right);
  const total = frameTimesMs.reduce((sum, frameTime) => sum + frameTime, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const targetFrameTime = 1000 / targetFps;

  return {
    averageFps: round(1000 / (total / frameTimesMs.length)),
    minimumFps: round(1000 / Math.max(...frameTimesMs)),
    p95FrameTimeMs: round(sorted[p95Index] ?? 0),
    droppedFrames: frameTimesMs.filter((frameTime) => frameTime > targetFrameTime * 1.5).length,
    sampleCount: frameTimesMs.length,
  };
}
