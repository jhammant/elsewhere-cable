import { describe, expect, it } from 'vitest';
import {
  categoryDiversityScore,
  concreteMotifPhrases,
  deliveryPacingDirection,
  pacingCandidatesForDelivery,
  programmeUniquenessScore,
  repeatedStoryPhrases,
  windowDiversityMetrics,
} from './optimisation-policy.js';

describe('delivery-aware pacing policy', () => {
  it('does not request quiet or slow pacing while the public feed is already too silent', () => {
    expect(pacingCandidatesForDelivery({ silenceRatio: 0.31, freezeRatio: 0.1 })).toEqual([
      'frantic',
      'staccato',
      'interrupted',
    ]);
  });

  it('does not request quiet or slow pacing while the public feed is visually static', () => {
    expect(pacingCandidatesForDelivery({ silenceRatio: 0.04, freezeRatio: 0.68 })).not.toContain(
      'slow_burn',
    );
    expect(deliveryPacingDirection({ silenceRatio: 0.04, freezeRatio: 0.68 })).toContain(
      'visible action',
    );
  });

  it('keeps correction active until delivered silence is genuinely low', () => {
    expect(pacingCandidatesForDelivery({ silenceRatio: 0.16, freezeRatio: 0.07 })).toEqual([
      'frantic',
      'staccato',
      'interrupted',
    ]);
    expect(deliveryPacingDirection({ silenceRatio: 0.16, freezeRatio: 0.07 })).toContain(
      'continuous audible presence',
    );
  });

  it('keeps every pacing mode available when delivery is healthy', () => {
    expect(pacingCandidatesForDelivery({ silenceRatio: 0.05, freezeRatio: 0.12 })).toContain(
      'near_silent',
    );
    expect(deliveryPacingDirection({ silenceRatio: 0.05, freezeRatio: 0.12 })).toBeNull();
  });

  it('steers novelty with repeated story phrases instead of banning ordinary words', () => {
    const phrases = repeatedStoryPhrases([
      'At the service desk, a resident submits a grandfather clock for inspection.',
      'Your second resident brings the grandfather clock back to the desk.',
      'A third resident admits the grandfather clock has its own receipt.',
    ]);

    expect(phrases).toContain('grandfather clock');
    expect(phrases).not.toContain('resident');
    expect(phrases).not.toContain('service');
    expect(phrases).not.toContain('your');
    expect(phrases).not.toContain('back');
  });

  it('collapses overlapping repeated phrases into one concrete motif', () => {
    expect(
      repeatedStoryPhrases([
        'The red umbrella factory opens.',
        'The red umbrella factory closes.',
        'The red umbrella factory apologises.',
      ]),
    ).toEqual(['red umbrella factory']);
  });

  it('rejects generic one-word critic motifs while retaining concrete noun phrases', () => {
    expect(
      concreteMotifPhrases([
        'resident',
        'service',
        'your',
        'voice',
        'the red',
        'grandfather clock',
        'insurance policy',
        '  RUBBISH BIN  ',
        'apologise for decisions',
        'committee has not',
        'conduct formal performance',
        'not made yet',
        'meeting meeting minutes',
      ]),
    ).toEqual(['grandfather clock', 'insurance policy', 'rubbish bin']);
  });

  it('measures exact programme repetition separately from style coverage', () => {
    const metrics = windowDiversityMetrics([
      {
        programmeTitle: 'Programme A',
        format: 'news',
        visualMedium: 'pixel_broadcast',
        castArchetype: 'humanoid',
        pacing: 'frantic',
      },
      {
        programmeTitle: 'Programme A',
        format: 'news',
        visualMedium: 'paper_cutout',
        castArchetype: 'paper_puppets',
        pacing: 'staccato',
      },
      {
        programmeTitle: 'Programme B',
        format: 'sitcom',
        visualMedium: 'cel_shaded',
        castArchetype: 'humanoid',
        pacing: 'conversational',
      },
    ]);

    expect(metrics).toEqual({
      uniqueProgrammes: 2,
      programmeRepeats: 1,
      programmeUniquenessRatio: 2 / 3,
      uniqueFormats: 2,
      uniqueVisualMedia: 3,
      uniqueCastArchetypes: 2,
      uniquePacingModes: 3,
    });
    expect(programmeUniquenessScore(metrics)).toBe(7);
  });

  it('scores category balance without awarding full marks for four of six modes', () => {
    expect(categoryDiversityScore(['a', 'b', 'c', 'd'], 6)).toBe(8);
    expect(categoryDiversityScore(['a', 'a', 'a', 'a'], 6)).toBe(0);
    expect(categoryDiversityScore(['a', 'b', 'c', 'd', 'e', 'f'], 6)).toBe(10);
  });
});
