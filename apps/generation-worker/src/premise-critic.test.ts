import { describe, expect, it } from 'vitest';
import { demoDraft } from './creative.js';
import { critiquePremise } from './premise-critic.js';

describe('premise critic', () => {
  it('accepts the expanded hand-authored comedy network', () => {
    for (let index = 0; index < 32; index += 1) {
      expect(critiquePremise(demoDraft(index)).reasons, `demo draft ${index}`).toEqual([]);
    }
  });

  it('rejects randomness without a playable rule', () => {
    const incoherent = demoDraft(0);
    incoherent.premise = 'Random wacky nonsense happens for no reason.';
    incoherent.dialogue = incoherent.dialogue.map((line) => ({
      ...line,
      action: 'IDLE',
    }));
    incoherent.endingBeat = 'Static.';

    const critique = critiquePremise(incoherent);
    expect(critique.accepted).toBe(false);
    expect(critique.reasons.some((reason) => reason.includes('comic mechanism'))).toBe(true);
    expect(critique.reasons.some((reason) => reason.includes('reaction or action'))).toBe(true);
    expect(critique.reasons.some((reason) => reason.includes('visual payoff'))).toBe(true);
  });

  it('reserves Elsewhere Cable for the network identity', () => {
    const channelCollision = demoDraft(0);
    channelCollision.channelName = 'Elsewhere Cable';

    const critique = critiquePremise(channelCollision);
    expect(critique.accepted).toBe(false);
    expect(critique.reasons.some((reason) => reason.includes('network identity'))).toBe(true);
  });
});
