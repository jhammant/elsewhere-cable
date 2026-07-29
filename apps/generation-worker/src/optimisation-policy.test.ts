import { describe, expect, it } from 'vitest';
import { deliveryPacingDirection, pacingCandidatesForDelivery } from './optimisation-policy.js';

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

  it('keeps every pacing mode available when delivery is healthy', () => {
    expect(pacingCandidatesForDelivery({ silenceRatio: 0.05, freezeRatio: 0.12 })).toContain(
      'near_silent',
    );
    expect(deliveryPacingDirection({ silenceRatio: 0.05, freezeRatio: 0.12 })).toBeNull();
  });
});
