import { describe, expect, it } from 'vitest';
import { containsSpokenStageDirection } from './dialogue-quality.js';

describe('spoken stage direction detection', () => {
  it.each([
    'The camera cuts and the podium shrinks again.',
    'Camera zooms toward the receipt.',
    'Cut to the wide shot.',
    'Fade to the unavailable programme.',
  ])('rejects narrated production direction: %s', (line) => {
    expect(containsSpokenStageDirection(line)).toBe(true);
  });

  it.each([
    'The camera lens is out of focus.',
    'The view from the top is superior.',
    'This picture frame belongs to my shoe.',
  ])('allows dialogue that merely discusses production objects: %s', (line) => {
    expect(containsSpokenStageDirection(line)).toBe(false);
  });
});
