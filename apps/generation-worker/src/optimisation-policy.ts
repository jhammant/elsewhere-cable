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

export function deliveryNeedsCorrection(delivery: DeliveryPacingSignal): boolean {
  return (
    (delivery.silenceRatio !== null && delivery.silenceRatio >= 0.12) ||
    (delivery.freezeRatio !== null && delivery.freezeRatio >= 0.18)
  );
}

export function pacingCandidatesForDelivery(delivery: DeliveryPacingSignal): readonly PacingMode[] {
  if (deliveryNeedsCorrection(delivery)) {
    return ['frantic', 'staccato', 'interrupted'];
  }
  return pacingModes;
}

export function deliveryPacingDirection(delivery: DeliveryPacingSignal): string | null {
  if (deliveryNeedsCorrection(delivery)) {
    return 'Reduce prolonged silence and static holds; favour visible action, frequent shot changes and continuous audible presence.';
  }
  return null;
}
