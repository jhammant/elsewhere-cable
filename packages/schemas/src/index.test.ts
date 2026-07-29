import { describe, expect, it } from 'vitest';
import {
  optimisationBriefSchema,
  playoutManifestSchema,
  playoutObservationSchema,
  preparedScriptSchema,
  segmentPackageSchema,
} from './index.js';

describe('optimisationBriefSchema', () => {
  it('accepts a complete editorial direction longer than a list item', () => {
    const editorialDirection =
      'Anchor each segment in one social conflict, let every response change the situation, and end on a visible consequence that follows from the same comic rule instead of introducing an unrelated final image.';
    const brief = optimisationBriefSchema.parse({
      schemaVersion: 1,
      generatedAt: '2026-07-29T18:00:00.000Z',
      windowMinutes: 30,
      sampleSize: 20,
      scores: {
        premiseClarity: 6,
        comedyEscalation: 6,
        dialogueCoherence: 6,
        visualMatch: 6,
        paceVariety: 6,
        originality: 6,
        shareability: 6,
      },
      increaseFormats: ['sitcom'],
      increasePacing: ['staccato'],
      avoidMotifs: ['costume rotation'],
      preserveStrengths: ['visible cause and effect'],
      editorialDirection,
      delivery: {
        isLive: true,
        concurrentViewers: 1,
        silenceRatio: 0,
        freezeRatio: 0,
        fallbackOccurrences: 0,
      },
    });

    expect(brief.editorialDirection).toBe(editorialDirection);
    expect(brief.editorialDirection.length).toBeGreaterThan(120);
  });
});

describe('segmentPackageSchema', () => {
  it('rejects renderer events after the segment duration', () => {
    const result = segmentPackageSchema.safeParse({
      schemaVersion: 1,
      segmentId: 'seg_test',
      channel: { id: 'channel_42', number: 42, name: 'Test', realityId: 'TEST-1' },
      programme: {
        id: 'programme_test',
        title: 'Test',
        format: 'ident',
        premise: 'A test.',
      },
      durationMs: 5_000,
      visualStyle: 'test',
      tone: ['dry'],
      events: [{ atMs: 6_000, type: 'transition.play', transition: 'HARD_CUT' }],
      continuityUpdates: [],
      suggestedExit: {
        earliestMs: 4_000,
        preferredMs: 5_000,
        transition: 'HARD_CUT',
      },
      production: {
        generatedAt: new Date().toISOString(),
        generator: 'test',
        model: 'test',
        safetyStatus: 'approved-for-local-preview',
        audioPrepared: false,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('playoutManifestSchema', () => {
  it('accepts an empty fallback manifest', () => {
    expect(
      playoutManifestSchema.parse({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 0,
        segments: [],
      }).segments,
    ).toHaveLength(0);
  });
});

describe('playoutObservationSchema', () => {
  it('accepts a bounded segment-start observation', () => {
    const observation = playoutObservationSchema.parse({
      schemaVersion: 1,
      occurrenceId: '9f59e377-cade-4b9c-a37c-1c56bd002a24',
      observedAt: '2026-07-29T12:00:00.000Z',
      event: 'segment.started',
      segmentId: 'seg_test',
      channelNumber: 83_040_021,
      channelName: 'Test Channel',
      programmeId: 'test_programme',
      programmeTitle: 'Test Programme',
      format: 'sitcom',
      visualMedium: 'paper_cutout',
      pacing: 'staccato',
      durationMs: 45_000,
    });

    expect(observation.event).toBe('segment.started');
  });
});

describe('preparedScriptSchema', () => {
  it('validates a versioned prepared script without making it playable', () => {
    const prepared = preparedScriptSchema.parse({
      schemaVersion: 1,
      draftId: 'draft_01prepared',
      preparedAt: '2026-07-29T18:00:00.000Z',
      generator: 'test-generator',
      model: 'test-model',
      draft: {
        channelNumber: 8_818_881,
        channelName: 'Queue Waiting Room',
        programmeTitle: 'Your Script Is Important To Us',
        format: 'public_access',
        realityId: 'QUEUE-8',
        visualStyle: 'paper_queue',
        visualMedium: 'paper_cutout',
        castArchetype: 'humanoid',
        pacing: 'slow_burn',
        premise: 'Unproduced television scripts complain about their position in the queue.',
        tone: ['dry', 'bureaucratic'],
        dialogue: [
          { speaker: 'Script One', text: 'I was promised a voice by Tuesday.', action: 'IDLE' },
          { speaker: 'Clerk', text: 'Which Tuesday did you request?', action: 'LOOK_AT' },
          {
            speaker: 'Script One',
            text: 'The one with the affordable weather.',
            action: 'POINT_AT',
          },
          { speaker: 'Clerk', text: 'That Tuesday is still in rendering.', action: 'PAUSE' },
        ],
        continuityFact: 'Some Tuesdays remain in rendering.',
        endingBeat: 'The queue ticket begins interviewing the clerk.',
      },
    });

    expect(prepared.draft.programmeTitle).toBe('Your Script Is Important To Us');
  });
});
