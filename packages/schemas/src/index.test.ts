import { describe, expect, it } from 'vitest';
import {
  playoutManifestSchema,
  playoutObservationSchema,
  preparedScriptSchema,
  segmentPackageSchema,
} from './index.js';

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
