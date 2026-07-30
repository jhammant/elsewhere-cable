import { describe, expect, it } from 'vitest';
import type { PlayoutManifest } from '@elsewhere-cable/schemas';
import { prioritiseNewEntries } from './live-priority.js';

function manifest(ids: readonly string[]): PlayoutManifest {
  return {
    schemaVersion: 1,
    generatedAt: '2026-07-30T00:00:00.000Z',
    totalDurationMs: ids.length * 10_000,
    segments: ids.map((segmentId, index) => ({
      segmentId,
      packagePath: `${segmentId}/segment.json`,
      durationMs: 10_000,
      channelNumber: index + 1,
      channelName: `Channel ${index + 1}`,
      programmeTitle: `Programme ${index + 1}`,
    })),
  };
}

describe('live original prioritisation', () => {
  it('places new originals after a safety lookahead without changing the current clip', () => {
    const input = manifest([
      'seg_a',
      'seg_current',
      'seg_b',
      'seg_c',
      'seg_d',
      'seg_new_one',
      'seg_new_two',
      'seg_e',
    ]);
    const result = prioritiseNewEntries(input, 'seg_current', ['seg_new_one', 'seg_new_two'], 2);

    expect(result.reordered).toBe(true);
    expect(result.insertedAfterSegmentId).toBe('seg_c');
    expect(result.manifest.segments.map(({ segmentId }) => segmentId)).toEqual([
      'seg_a',
      'seg_current',
      'seg_b',
      'seg_c',
      'seg_new_one',
      'seg_new_two',
      'seg_d',
      'seg_e',
    ]);
    expect(result.manifest.totalDurationMs).toBe(input.totalDurationMs);
  });

  it('does nothing when the observed live segment is absent', () => {
    const input = manifest(['seg_a', 'seg_new', 'seg_b']);
    const result = prioritiseNewEntries(input, 'seg_missing', ['seg_new'], 3);

    expect(result.reordered).toBe(false);
    expect(result.manifest).toBe(input);
  });
});
