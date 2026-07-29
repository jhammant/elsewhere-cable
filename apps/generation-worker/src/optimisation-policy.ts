export const pacingModes = [
  'frantic',
  'staccato',
  'conversational',
  'slow_burn',
  'interrupted',
  'near_silent',
] as const;

export type PacingMode = (typeof pacingModes)[number];

interface DeliveryPacingSignal {
  silenceRatio: number | null;
  freezeRatio: number | null;
}

export function pacingCandidatesForDelivery(delivery: DeliveryPacingSignal): readonly PacingMode[] {
  const excessiveSilence = delivery.silenceRatio !== null && delivery.silenceRatio >= 0.18;
  const excessiveFreeze = delivery.freezeRatio !== null && delivery.freezeRatio >= 0.3;
  if (excessiveSilence || excessiveFreeze) {
    return ['frantic', 'staccato', 'interrupted'];
  }
  return pacingModes;
}

export function deliveryPacingDirection(delivery: DeliveryPacingSignal): string | null {
  if (
    (delivery.silenceRatio !== null && delivery.silenceRatio >= 0.18) ||
    (delivery.freezeRatio !== null && delivery.freezeRatio >= 0.3)
  ) {
    return 'Reduce prolonged silence and static holds; favour visible action, frequent shot changes and continuous audible presence.';
  }
  return null;
}
