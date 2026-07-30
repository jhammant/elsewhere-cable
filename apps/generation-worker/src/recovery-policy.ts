import type { PlayoutManifest } from '@elsewhere-cable/schemas';

export interface RecoveryRunwayDecision {
  needed: boolean;
  reason: 'below-minimum-runway' | 'healthy-runway' | 'current-segment-missing';
  aheadDurationMs: number;
  aheadSegmentCount: number;
  aheadOriginalCount: number;
  aheadRecoveryCount: number;
}

export function recoveryRunwayDecision(
  manifest: PlayoutManifest,
  currentSegmentId: string,
  minimumAheadMs: number,
): RecoveryRunwayDecision {
  const currentIndex = manifest.segments.findIndex(
    (entry) => entry.segmentId === currentSegmentId,
  );
  if (currentIndex === -1) {
    return {
      needed: true,
      reason: 'current-segment-missing',
      aheadDurationMs: 0,
      aheadSegmentCount: 0,
      aheadOriginalCount: 0,
      aheadRecoveryCount: 0,
    };
  }

  const ahead = manifest.segments.slice(currentIndex + 1);
  const aheadDurationMs = ahead.reduce((total, entry) => total + entry.durationMs, 0);
  const aheadRecoveryCount = ahead.filter((entry) =>
    entry.segmentId.startsWith('seg_recovery_'),
  ).length;
  const needed = aheadDurationMs < minimumAheadMs;

  return {
    needed,
    reason: needed ? 'below-minimum-runway' : 'healthy-runway',
    aheadDurationMs,
    aheadSegmentCount: ahead.length,
    aheadOriginalCount: ahead.length - aheadRecoveryCount,
    aheadRecoveryCount,
  };
}
