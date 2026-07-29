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

  it('rejects warning dialogue without a comic disagreement', () => {
    const warningLoop = demoDraft(0);
    warningLoop.dialogue = warningLoop.dialogue.map((line, index) => ({
      ...line,
      text:
        index % 2 === 0
          ? 'Careful, the forbidden zone is spreading!'
          : 'It is too late, stay safe and keep away!',
    }));

    expect(critiquePremise(warningLoop).reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('generic warnings or peril')]),
    );
  });

  it('requires visible performance on at least three quarters of dialogue beats', () => {
    const staticDraft = demoDraft(0);
    staticDraft.dialogue = staticDraft.dialogue.map((line, index) => ({
      ...line,
      action: index < Math.ceil(staticDraft.dialogue.length * 0.5) ? line.action : 'IDLE',
    }));

    expect(critiquePremise(staticDraft).reasons).toContain(
      'at least three quarters of dialogue must have a playable reaction or action',
    );
  });

  it('rejects rule exposition and tragedy shortcuts', () => {
    const exposition = demoDraft(0);
    exposition.dialogue[0]!.text = 'The rule forces me to surrender my chair immediately.';
    exposition.dialogue[1]!.text =
      'The law takes effect whenever you mention your childhood trauma.';

    expect(critiquePremise(exposition).reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('explain the rule'),
        expect.stringContaining('unearned tragedy'),
      ]),
    );
  });

  it('rejects an ending that invents a transformation absent from the premise', () => {
    const unrelatedEnding = demoDraft(0);
    unrelatedEnding.endingBeat = 'The committee table suddenly shrinks into a postage stamp.';

    expect(critiquePremise(unrelatedEnding).reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('unearned mechanisms')]),
    );
  });
});
