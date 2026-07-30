import { describe, expect, it } from 'vitest';
import { mixedRecoveryCatalogue, rotateCatalogue } from './recovery-catalogue.js';

describe('recovery catalogue selection', () => {
  it('rotates a catalogue without losing entries', () => {
    expect(rotateCatalogue(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd', 'a', 'b']);
    expect(rotateCatalogue(['a', 'b', 'c'], -1)).toEqual(['c', 'a', 'b']);
  });

  it('mixes three approved originals between stable demos while both pools remain', () => {
    expect(
      mixedRecoveryCatalogue(
        ['original-1', 'original-2', 'original-3', 'original-4', 'original-5'],
        ['demo-1', 'demo-2'],
        0,
      ),
    ).toEqual([
      'original-1',
      'original-2',
      'original-3',
      'demo-1',
      'original-4',
      'original-5',
      'demo-2',
    ]);
  });

  it('rotates both pools between refill batches', () => {
    expect(
      mixedRecoveryCatalogue(
        ['original-1', 'original-2', 'original-3', 'original-4'],
        ['demo-1', 'demo-2', 'demo-3'],
        1,
      ).slice(0, 4),
    ).toEqual(['original-2', 'original-3', 'demo-1', 'original-4']);
  });

  it('visits the complete mixed catalogue before repeating a source', () => {
    const originals = Array.from({ length: 12 }, (_, index) => `original-${index}`);
    const demos = Array.from({ length: 4 }, (_, index) => `demo-${index}`);
    const firstBatch = mixedRecoveryCatalogue(originals, demos, 0).slice(0, 8);
    const secondBatch = mixedRecoveryCatalogue(originals, demos, 8).slice(0, 8);

    expect(new Set([...firstBatch, ...secondBatch]).size).toBe(16);
    expect(mixedRecoveryCatalogue(originals, demos, 16)[0]).toBe(firstBatch[0]);
  });

  it('uses whichever approved pool is available', () => {
    expect(mixedRecoveryCatalogue([], ['demo-1', 'demo-2'], 1)).toEqual(['demo-2', 'demo-1']);
    expect(mixedRecoveryCatalogue(['original-1'], [], 0)).toEqual(['original-1']);
  });
});
