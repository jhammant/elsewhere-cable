import { describe, expect, it } from 'vitest';
import { retainedPlayedSegmentIds } from './playback-history.js';

describe('played-segment history', () => {
  it('retains old observations when Docker log rotation loses them', () => {
    expect(
      retainedPlayedSegmentIds(
        ['seg_early_broadcast', 'seg_shared'],
        ['seg_shared', 'seg_recent_broadcast'],
      ),
    ).toEqual(['seg_early_broadcast', 'seg_shared', 'seg_recent_broadcast']);
  });

  it('rejects malformed values before they reach browser storage', () => {
    expect(
      retainedPlayedSegmentIds(
        ['seg_safe', '../../state', ''],
        ['not-a-segment', ' seg_new_safe '],
      ),
    ).toEqual(['seg_safe', 'seg_new_safe']);
  });
});
