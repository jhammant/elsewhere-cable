import { describe, expect, it } from 'vitest';
import type { PlayoutManifest } from '@elsewhere-cable/schemas';
import { recoveryRunwayDecision } from './recovery-policy.js';

function manifest(ids: readonly string[], durationMs = 10 * 60_000): PlayoutManifest {
  return {
    schemaVersion: 1,
    generatedAt: '2026-07-30T02:00:00.000Z',
    totalDurationMs: ids.length * durationMs,
    segments: ids.map((segmentId, index) => ({
      segmentId,
      packagePath: `${segmentId}/segment.json`,
      durationMs,
      channelNumber: index + 1,
      channelName: `Channel ${index + 1}`,
      programmeTitle: `Programme ${index + 1}`,
    })),
  };
}

describe('recovery runway policy', () => {
  it('does not add aliases while the observed live cursor has a healthy runway', () => {
    const decision = recoveryRunwayDecision(
      manifest([
        'seg_current',
        'seg_original_one',
        'seg_recovery_safe_one',
        'seg_original_two',
        'seg_recovery_safe_two',
      ]),
      'seg_current',
      30 * 60_000,
    );

    expect(decision).toEqual({
      needed: false,
      reason: 'healthy-runway',
      aheadDurationMs: 40 * 60_000,
      aheadSegmentCount: 4,
      aheadOriginalCount: 2,
      aheadRecoveryCount: 2,
    });
  });

  it('permits recovery material near the end because repeat is better than dead air', () => {
    const decision = recoveryRunwayDecision(
      manifest(['seg_old', 'seg_current', 'seg_original_last'], 8 * 60_000),
      'seg_current',
      30 * 60_000,
    );

    expect(decision.needed).toBe(true);
    expect(decision.reason).toBe('below-minimum-runway');
    expect(decision.aheadDurationMs).toBe(8 * 60_000);
  });

  it('fails open for availability when the live cursor cannot be mapped safely', () => {
    expect(
      recoveryRunwayDecision(manifest(['seg_a', 'seg_b']), 'seg_missing', 30 * 60_000),
    ).toMatchObject({
      needed: true,
      reason: 'current-segment-missing',
    });
  });
});
