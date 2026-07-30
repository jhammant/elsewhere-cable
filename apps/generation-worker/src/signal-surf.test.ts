import { describe, expect, it } from 'vitest';
import { critiquePremise } from './premise-critic.js';
import { noveltyIssues, recordFromDraft, type CreativeRecord } from './novelty.js';
import { previewSafetyIssues, proposalQualityIssues } from './production.js';
import { signalSurfDrafts } from './signal-surf.js';

describe('signal-surf editorial pack', () => {
  it('contains eleven original high-numbered channels with eleven production looks', () => {
    expect(signalSurfDrafts).toHaveLength(11);
    expect(new Set(signalSurfDrafts.map((draft) => draft.channelNumber)).size).toBe(11);
    expect(new Set(signalSurfDrafts.map((draft) => draft.channelName)).size).toBe(11);
    expect(new Set(signalSurfDrafts.map((draft) => draft.programmeTitle)).size).toBe(11);
    expect(new Set(signalSurfDrafts.map((draft) => draft.visualMedium)).size).toBe(11);
    expect(signalSurfDrafts.every((draft) => draft.channelNumber >= 6_000_000_000)).toBe(true);
  });

  it('covers every current programme format and radically different pacing', () => {
    expect(new Set(signalSurfDrafts.map((draft) => draft.format))).toEqual(
      new Set(['advert', 'emergency', 'ident', 'news', 'public_access', 'shopping', 'sitcom']),
    );
    expect(new Set(signalSurfDrafts.map((draft) => draft.pacing))).toEqual(
      new Set(['frantic', 'staccato', 'conversational', 'slow_burn', 'interrupted', 'near_silent']),
    );
  });

  it('passes deterministic safety, premise and internal novelty gates', () => {
    const history: CreativeRecord[] = [];
    for (const draft of signalSurfDrafts) {
      expect(
        [
          ...previewSafetyIssues(draft),
          ...proposalQualityIssues(draft),
          ...critiquePremise(draft).reasons,
          ...noveltyIssues(draft, history),
        ],
        draft.programmeTitle,
      ).toEqual([]);
      history.push(recordFromDraft(draft));
    }
  });
});
