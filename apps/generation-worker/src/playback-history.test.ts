import { describe, expect, it } from 'vitest';
import { retainedPlayedSegmentIds, successfulPlayedSegmentIds } from './playback-history.js';

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

  it('does not preserve a segment whose controller request failed validation', () => {
    const lines = [
      {
        reqId: 'req-good',
        req: { method: 'GET', url: '/api/playout/segments/seg_good' },
      },
      { reqId: 'req-good', res: { statusCode: 200 } },
      {
        reqId: 'req-bad',
        req: { method: 'GET', url: '/api/playout/segments/seg_bad' },
      },
      { reqId: 'req-bad', res: { statusCode: 500 } },
      'ffmpeg progress is not JSON',
    ]
      .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
      .join('\n');

    expect(successfulPlayedSegmentIds(lines)).toEqual(['seg_good']);
  });
});
