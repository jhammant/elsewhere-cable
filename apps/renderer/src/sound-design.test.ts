import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { describe, expect, it } from 'vitest';
import { soundCuesForSegment } from './sound-design.js';

function segment(): SegmentPackage {
  return {
    schemaVersion: 1,
    segmentId: 'seg_sound_test',
    channel: {
      id: 'channel_88001122',
      number: 88_001_122,
      name: 'Domestic Object Review',
      realityId: 'SOUND-4',
    },
    programme: {
      id: 'the_doorbell_review',
      title: 'The Doorbell Review',
      format: 'sitcom',
      premise: 'At a family table, two neighbours dispute who must return a tiny silver bell.',
    },
    durationMs: 13_000,
    visualStyle: 'paper domestic comedy',
    visualMedium: 'paper_cutout',
    castArchetype: 'paper_puppets',
    pacing: 'slow_burn',
    tone: ['dry'],
    events: [
      {
        atMs: 1_000,
        type: 'speech.play',
        speechId: 'speech_1',
        characterId: 'neighbour_a',
        characterName: 'Neighbour A',
        voiceId: 'voice_a',
        subtitle: 'Your doorbell rang before I had decided to visit.',
        audioFile: 'audio/speech_1.m4a',
        durationMs: 1_800,
      },
      {
        atMs: 5_000,
        type: 'speech.play',
        speechId: 'speech_2',
        characterId: 'neighbour_b',
        characterName: 'Neighbour B',
        voiceId: 'voice_b',
        subtitle: 'Then the telephone has misunderstood the appointment.',
        audioFile: 'audio/speech_2.m4a',
        durationMs: 1_900,
      },
    ],
    continuityUpdates: [],
    suggestedExit: {
      earliestMs: 10_000,
      preferredMs: 12_500,
      transition: 'STATIC_BURST',
    },
    production: {
      generatedAt: '2026-07-30T11:00:00.000Z',
      generator: 'test',
      model: 'test',
      safetyStatus: 'approved-for-local-preview',
      audioPrepared: true,
    },
  };
}

describe('soundCuesForSegment', () => {
  it('adds restrained format, spoken-prop and ending-prop cues deterministically', () => {
    const first = soundCuesForSegment(segment());
    const second = soundCuesForSegment(segment());

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      atMs: 80,
      cue: 'domestic_sting',
      reason: 'format',
    });
    expect(first.some(({ cue, reason }) => cue === 'bell' && reason === 'spoken-prop')).toBe(true);
    expect(first.some(({ cue, reason }) => cue === 'phone_chirp' && reason === 'spoken-prop')).toBe(
      true,
    );
    expect(first.some(({ cue, reason }) => cue === 'bell' && reason === 'ending-prop')).toBe(true);
  });

  it('keeps every decorative cue outside prepared speech intervals', () => {
    const candidate = segment();
    const speech = candidate.events.filter(
      (event): event is Extract<SegmentPackage['events'][number], { type: 'speech.play' }> =>
        event.type === 'speech.play',
    );

    for (const cue of soundCuesForSegment(candidate)) {
      for (const line of speech) {
        const overlaps =
          cue.atMs < line.atMs + line.durationMs && cue.atMs + cue.durationMs > line.atMs;
        expect(overlaps, `${cue.cue} overlaps ${line.speechId}`).toBe(false);
      }
    }
  });

  it('moves the format cue after unusually early speech', () => {
    const candidate = segment();
    const firstSpeech = candidate.events[0];
    if (firstSpeech?.type !== 'speech.play') {
      throw new Error('Expected the test fixture to begin with speech');
    }
    firstSpeech.atMs = 100;

    expect(soundCuesForSegment(candidate)[0]).toMatchObject({
      atMs: 1_945,
      cue: 'domestic_sting',
      reason: 'format',
    });
  });

  it('uses story-specific mechanisms for weather, frozen evidence and civic rulings', () => {
    const weather = segment();
    weather.programme.premise = 'A cloud opens a tiny weather hatch during the forecast.';
    weather.events = weather.events.map((event, index) =>
      event.type === 'speech.play' && index === 0
        ? { ...event, subtitle: 'Cloud Three has opened its staff entrance.' }
        : event,
    );
    expect(soundCuesForSegment(weather).some(({ cue }) => cue === 'cloud_hatch')).toBe(true);

    const freezer = segment();
    freezer.programme.premise = 'A frozen complaint begins to melt inside a civic freezer.';
    freezer.events = freezer.events.map((event, index) =>
      event.type === 'speech.play' && index === 0
        ? { ...event, subtitle: 'The frozen complaint was solid when it arrived.' }
        : event,
    );
    expect(soundCuesForSegment(freezer).some(({ cue }) => cue === 'freezer_latch')).toBe(true);

    const civic = segment();
    civic.programme.premise = 'An official stamps a refused appeal.';
    civic.events = civic.events.map((event, index) =>
      event.type === 'speech.play' && index === 0
        ? { ...event, subtitle: 'Your appeal has been refused by the chair.' }
        : event,
    );
    expect(soundCuesForSegment(civic).some(({ cue }) => cue === 'bureaucratic_stamp')).toBe(true);
  });

  it('synchronises only concrete spectrum and harmless impact language with effect sounds', () => {
    const spectrum = segment();
    spectrum.programme.premise =
      'At a weather desk, a presenter wants one rainbow filed before the prism changes shift.';
    spectrum.events = spectrum.events.map((event, index) =>
      event.type === 'speech.play' && index === 0
        ? { ...event, subtitle: 'The rainbow has arrived through the staff prism.' }
        : event,
    );
    const spectrumCues = soundCuesForSegment(spectrum).map(({ cue }) => cue);
    expect(spectrumCues).toContain('spectrum_sweep');

    const impact = segment();
    impact.programme.premise =
      'At a demonstration desk, a harmless paper burst awards the least impressed host.';
    impact.events = impact.events.map((event, index) =>
      event.type === 'speech.play' && index === 0
        ? { ...event, subtitle: 'The cardboard explodes into confetti when you compliment it.' }
        : event,
    );
    expect(soundCuesForSegment(impact).some(({ cue }) => cue === 'paper_burst')).toBe(true);

    const unrelated = segment();
    unrelated.programme.premise = 'At a table, two neighbours discuss a loud afternoon.';
    unrelated.events = unrelated.events.map((event) =>
      event.type === 'speech.play'
        ? { ...event, subtitle: 'I am surprised by your unusually emphatic choice.' }
        : event,
    );
    expect(
      soundCuesForSegment(unrelated).some(({ cue }) =>
        ['cel_impact', 'paper_burst', 'pixel_blast', 'signal_rupture'].includes(cue),
      ),
    ).toBe(false);
  });
});
