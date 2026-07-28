import { describe, expect, it } from 'vitest';
import type { PlayoutManifest } from '@elsewhere-cable/schemas';
import { applyVisualEvent, nextUnplayedIndex, type PlayoutVisuals } from './playout.js';

function visuals(): {
  target: PlayoutVisuals;
  cameras: string[];
  speakers: Array<[string, number]>;
  actions: Array<[string, string]>;
} {
  const cameras: string[] = [];
  const speakers: Array<[string, number]> = [];
  const actions: Array<[string, string]> = [];
  return {
    cameras,
    speakers,
    actions,
    target: {
      loadSegment: () => undefined,
      cutCamera: (camera) => cameras.push(camera),
      speak: (characterId, durationMs) => speakers.push([characterId, durationMs]),
      performAction: (characterId, action) => actions.push([characterId, action]),
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

  it('does not wrap to the beginning after every segment has aired', () => {
    expect(nextUnplayedIndex(manifest, 3, new Set(['one', 'two', 'three']))).toBeNull();
  });
});
