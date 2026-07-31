import { describe, expect, it } from 'vitest';
import type { PlayoutManifest, SegmentPackage } from '@elsewhere-cable/schemas';
import {
  applyVisualEvent,
  nextUnplayedIndex,
  playedIdsForNextCycle,
  segmentObservation,
  type PlayoutVisuals,
} from './playout.js';

function visuals(): {
  target: PlayoutVisuals;
  cameras: string[];
  speakers: Array<[string, number]>;
  actions: Array<[string, string]>;
  storyCues: string[];
} {
  const cameras: string[] = [];
  const speakers: Array<[string, number]> = [];
  const actions: Array<[string, string]> = [];
  const storyCues: string[] = [];
  return {
    cameras,
    speakers,
    actions,
    storyCues,
    target: {
      loadSegment: () => undefined,
      cutCamera: (camera) => cameras.push(camera),
      speak: (characterId, durationMs) => speakers.push([characterId, durationMs]),
      performAction: (characterId, action) => actions.push([characterId, action]),
      performStoryCue: (cue) => storyCues.push(cue.cue),
    },
  };
}

describe('applyVisualEvent', () => {
  it('drives the camera, active speaker, and character action from segment timing events', () => {
    const testVisuals = visuals();

    applyVisualEvent({ atMs: 200, type: 'camera.cut', camera: 'CAMERA_HOST' }, testVisuals.target);
    applyVisualEvent(
      {
        atMs: 250,
        type: 'speech.play',
        speechId: 'speech_host_1',
        characterId: 'host_1',
        characterName: 'Host',
        voiceId: 'voice_host',
        subtitle: 'This sentence drives the matching mouth movement.',
        audioFile: 'audio/host_1.aac',
        durationMs: 2_400,
      },
      testVisuals.target,
    );
    applyVisualEvent(
      {
        atMs: 250,
        type: 'character.action',
        characterId: 'host_1',
        action: 'POINT_AT',
      },
      testVisuals.target,
    );

    expect(testVisuals.cameras).toEqual(['CAMERA_HOST']);
    expect(testVisuals.speakers).toEqual([['host_1', 2_400]]);
    expect(testVisuals.actions).toEqual([['host_1', 'POINT_AT']]);
  });

  it('safely ignores non-scene events', () => {
    const testVisuals = visuals();

    applyVisualEvent(
      {
        atMs: 0,
        type: 'graphic.show',
        graphic: 'TITLE_CARD',
        text: 'Programme already in progress',
      },
      testVisuals.target,
    );

    expect(testVisuals.cameras).toEqual([]);
    expect(testVisuals.speakers).toEqual([]);
    expect(testVisuals.actions).toEqual([]);
  });
});

describe('single-use playout selection', () => {
  const manifest: PlayoutManifest = {
    schemaVersion: 1,
    generatedAt: '2026-07-28T10:00:00.000Z',
    totalDurationMs: 30_000,
    segments: ['one', 'two', 'three'].map((segmentId, index) => ({
      segmentId,
      packagePath: `${segmentId}/segment.json`,
      durationMs: 10_000,
      channelNumber: index + 1,
      channelName: `Channel ${index + 1}`,
      programmeTitle: `Programme ${index + 1}`,
    })),
  };

  it('selects the next segment that has not aired', () => {
    expect(nextUnplayedIndex(manifest, 0, new Set(['one']))).toBe(1);
  });

  it('wraps after an atomic queue replacement to find unaired material', () => {
    expect(nextUnplayedIndex(manifest, 3, new Set(['one']))).toBe(1);
  });

  it('does not wrap to the beginning after every segment has aired', () => {
    expect(nextUnplayedIndex(manifest, 3, new Set(['one', 'two', 'three']))).toBeNull();
  });

  it('reopens only the active manifest while retaining older archive history', () => {
    expect(
      [...playedIdsForNextCycle(manifest, new Set(['retired', 'one', 'two', 'three']))],
    ).toEqual(['retired']);
  });
});

describe('playout observations', () => {
  it('records the production grammar attached to an aired segment', () => {
    const segment: SegmentPackage = {
      schemaVersion: 1,
      segmentId: 'seg_observed',
      channel: {
        id: 'channel_83040021',
        number: 83_040_021,
        name: 'Observed Channel',
        realityId: 'OBS-1',
      },
      programme: {
        id: 'observed_programme',
        title: 'Observed Programme',
        format: 'sitcom',
        premise: 'Two paper officials disagree about which crease counts as a corridor.',
      },
      durationMs: 45_000,
      visualStyle: 'hinged paper hearing',
      visualMedium: 'paper_cutout',
      castArchetype: 'paper_puppets',
      pacing: 'staccato',
      tone: ['dry'],
      events: [{ atMs: 0, type: 'camera.cut', camera: 'CAMERA_WIDE' }],
      continuityUpdates: [],
      suggestedExit: {
        earliestMs: 42_000,
        preferredMs: 45_000,
        transition: 'STATIC_BURST',
      },
      production: {
        generatedAt: '2026-07-29T12:00:00.000Z',
        generator: 'test',
        model: 'test',
        safetyStatus: 'approved-for-local-preview',
        audioPrepared: true,
      },
    };

    const observation = segmentObservation(
      'segment.started',
      '9f59e377-cade-4b9c-a37c-1c56bd002a24',
      segment,
    );

    expect(observation).toMatchObject({
      event: 'segment.started',
      segmentId: 'seg_observed',
      visualMedium: 'paper_cutout',
      pacing: 'staccato',
      durationMs: 45_000,
    });
  });
});
