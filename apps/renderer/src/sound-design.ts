import type { SegmentPackage } from '@elsewhere-cable/schemas';

export type BroadcastSoundCue =
  | 'advisory_chime'
  | 'applause'
  | 'bell'
  | 'buzzer'
  | 'cash_register'
  | 'clink'
  | 'continuity_blip'
  | 'domestic_sting'
  | 'knock'
  | 'mechanical_click'
  | 'paper_rustle'
  | 'phone_chirp'
  | 'teletype'
  | 'tick'
  | 'tuning'
  | 'vhs_click'
  | 'wood_tap';

export interface ScheduledSoundCue {
  atMs: number;
  cue: BroadcastSoundCue;
  durationMs: number;
  gain: number;
  seed: number;
  reason: 'format' | 'spoken-prop' | 'ending-prop';
}

const cueDurationMs: Record<BroadcastSoundCue, number> = {
  advisory_chime: 260,
  applause: 280,
  bell: 220,
  buzzer: 170,
  cash_register: 220,
  clink: 120,
  continuity_blip: 160,
  domestic_sting: 240,
  knock: 190,
  mechanical_click: 120,
  paper_rustle: 170,
  phone_chirp: 260,
  teletype: 230,
  tick: 90,
  tuning: 180,
  vhs_click: 130,
  wood_tap: 140,
};

const formatCue: Record<SegmentPackage['programme']['format'], BroadcastSoundCue> = {
  advert: 'cash_register',
  shopping: 'cash_register',
  news: 'teletype',
  sitcom: 'domestic_sting',
  emergency: 'advisory_chime',
  ident: 'continuity_blip',
  public_access: 'vhs_click',
};

const lexicalCues: ReadonlyArray<{ pattern: RegExp; cue: BroadcastSoundCue }> = [
  { pattern: /\b(?:doorbell|handbell|tiny silver bell)\b/iu, cue: 'bell' },
  { pattern: /\b(?:telephone|phone|hotline|call-in)\b/iu, cue: 'phone_chirp' },
  { pattern: /\b(?:buzzer|wrong-answer tone)\b/iu, cue: 'buzzer' },
  { pattern: /\b(?:knock|door|visitor)\b/iu, cue: 'knock' },
  { pattern: /\b(?:applause|audience|clapping|laugh track)\b/iu, cue: 'applause' },
  { pattern: /\b(?:clock|countdown|timer|timetable)\b/iu, cue: 'tick' },
  {
    pattern:
      /\b(?:apology card|caption|card|form|label|leaflet|letter|menu|paper|photograph|programme|receipt|script|shopping list|ticket)\b/iu,
    cue: 'paper_rustle',
  },
  {
    pattern: /\b(?:bell|bowl|key|mug|plate|spoon|trophy)\b/iu,
    cue: 'clink',
  },
  {
    pattern: /\b(?:chair|desk|furniture|ladder|table|wooden)\b/iu,
    cue: 'wood_tap',
  },
  {
    pattern: /\b(?:button|device|machine|product|remote|switch|tool)\b/iu,
    cue: 'mechanical_click',
  },
];

function cueForText(text: string): BroadcastSoundCue | null {
  return lexicalCues.find(({ pattern }) => pattern.test(text))?.cue ?? null;
}

function cueSeed(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash || 1;
}

function cue(
  segmentId: string,
  index: number,
  atMs: number,
  sound: BroadcastSoundCue,
  gain: number,
  reason: ScheduledSoundCue['reason'],
): ScheduledSoundCue {
  return {
    atMs,
    cue: sound,
    durationMs: cueDurationMs[sound],
    gain,
    seed: cueSeed(`${segmentId}:${index}:${sound}`),
    reason,
  };
}

function firstSafeCueTime(
  speech: ReadonlyArray<
    Extract<SegmentPackage['events'][number], { type: 'speech.play' }>
  >,
  durationMs: number,
  preferredAtMs: number,
  latestEndMs: number,
): number | null {
  let candidateAtMs = preferredAtMs;
  for (const event of speech) {
    const speechEndsAtMs = event.atMs + event.durationMs;
    if (candidateAtMs + durationMs <= event.atMs - 45) {
      return candidateAtMs;
    }
    if (candidateAtMs < speechEndsAtMs + 45) {
      candidateAtMs = speechEndsAtMs + 45;
    }
  }
  return candidateAtMs + durationMs <= latestEndMs ? candidateAtMs : null;
}

/**
 * Derives a restrained soundtrack from already validated programme metadata.
 * Cues occupy speech gaps or the final hold; they never replace prepared voice
 * audio and never require a new renderer-protocol instruction.
 */
export function soundCuesForSegment(segment: SegmentPackage): ScheduledSoundCue[] {
  const speech = segment.events
    .filter(
      (
        event,
      ): event is Extract<SegmentPackage['events'][number], { type: 'speech.play' }> =>
        event.type === 'speech.play',
    )
    .sort((left, right) => left.atMs - right.atMs);
  const openingSound = formatCue[segment.programme.format];
  const openingAtMs = firstSafeCueTime(
    speech,
    cueDurationMs[openingSound],
    80,
    segment.durationMs - 260,
  );
  const cues: ScheduledSoundCue[] =
    openingAtMs === null
      ? []
      : [cue(segment.segmentId, 0, openingAtMs, openingSound, 0.026, 'format')];
  let previousSpeechEnd = 0;
  let spokenPropCueCount = 0;
  let previousSpecificCue: BroadcastSoundCue | null = null;
  for (const [index, event] of speech.entries()) {
    const sound = cueForText(event.subtitle);
    if (sound !== null && sound !== previousSpecificCue && spokenPropCueCount < 2) {
      const durationMs = cueDurationMs[sound];
      const atMs = event.atMs - durationMs - 45;
      if (atMs >= previousSpeechEnd + 45 && atMs >= 300) {
        cues.push(cue(segment.segmentId, index + 1, atMs, sound, 0.022, 'spoken-prop'));
        previousSpecificCue = sound;
        spokenPropCueCount += 1;
      }
    }
    previousSpeechEnd = Math.max(previousSpeechEnd, event.atMs + event.durationMs);
  }

  const endingSound = cueForText(
    `${speech.at(-1)?.subtitle ?? ''} ${segment.programme.premise}`,
  );
  if (endingSound !== null) {
    const durationMs = cueDurationMs[endingSound];
    const atMs = previousSpeechEnd + 120;
    if (
      atMs >= 400 &&
      atMs + durationMs <= segment.durationMs - 260 &&
      (cues.at(-1)?.atMs ?? 0) + 300 < atMs
    ) {
      cues.push(
        cue(
          segment.segmentId,
          cues.length,
          atMs,
          endingSound,
          0.028,
          'ending-prop',
        ),
      );
    }
  }

  return cues.sort((left, right) => left.atMs - right.atMs);
}

export class BroadcastSoundDesigner {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly activeSources = new Set<AudioScheduledSourceNode>();

  constructor(private readonly enabled: () => boolean) {}

  reset(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // An already-ended one-shot is safe to forget between segments.
      }
    }
    this.activeSources.clear();
  }

  play(scheduled: ScheduledSoundCue): void {
    if (!this.enabled()) {
      return;
    }
    try {
      const context = this.audioContext();
      void context.resume();
      this.renderCue(context, scheduled);
    } catch {
      // Decorative sound must never interrupt prepared speech or playout.
    }
  }

  private audioContext(): AudioContext {
    this.context ??= new AudioContext({ latencyHint: 'playback' });
    if (this.master === null) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private track(source: AudioScheduledSourceNode): void {
    this.activeSources.add(source);
    source.addEventListener('ended', () => this.activeSources.delete(source), { once: true });
  }

  private tone(
    context: AudioContext,
    frequency: number,
    durationMs: number,
    gain: number,
    type: OscillatorType,
    offsetMs = 0,
    endFrequency = frequency,
  ): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const startsAt = context.currentTime + offsetMs / 1_000;
    const endsAt = startsAt + durationMs / 1_000;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), startsAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), endsAt);
    envelope.gain.setValueAtTime(0.0001, startsAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), startsAt + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(envelope);
    envelope.connect(this.master!);
    this.track(oscillator);
    oscillator.start(startsAt);
    oscillator.stop(endsAt + 0.01);
  }

  private noise(
    context: AudioContext,
    durationMs: number,
    gain: number,
    seed: number,
    frequency: number,
    offsetMs = 0,
  ): void {
    const frameCount = Math.max(1, Math.floor((context.sampleRate * durationMs) / 1_000));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let state = seed >>> 0;
    for (let index = 0; index < samples.length; index += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      samples[index] = (state / 0x80000000 - 1) * 0.7;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const startsAt = context.currentTime + offsetMs / 1_000;
    const endsAt = startsAt + durationMs / 1_000;
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    envelope.gain.setValueAtTime(0.0001, startsAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), startsAt + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master!);
    this.track(source);
    source.start(startsAt);
    source.stop(endsAt + 0.01);
  }

  private renderCue(context: AudioContext, scheduled: ScheduledSoundCue): void {
    const gain = scheduled.gain;
    switch (scheduled.cue) {
      case 'advisory_chime':
        this.tone(context, 520, 210, gain, 'sine', 0, 660);
        this.tone(context, 780, 180, gain * 0.65, 'sine', 55, 880);
        break;
      case 'applause':
        this.noise(context, 70, gain, scheduled.seed, 1_400);
        this.noise(context, 70, gain, scheduled.seed + 1, 1_700, 85);
        this.noise(context, 70, gain, scheduled.seed + 2, 1_300, 170);
        break;
      case 'bell':
        this.tone(context, 920, 210, gain, 'sine');
        this.tone(context, 1_380, 190, gain * 0.62, 'sine', 8);
        break;
      case 'buzzer':
        this.tone(context, 190, 160, gain, 'sawtooth', 0, 160);
        break;
      case 'cash_register':
        this.tone(context, 680, 70, gain, 'square');
        this.tone(context, 1_180, 120, gain * 0.8, 'sine', 72, 1_480);
        break;
      case 'clink':
        this.tone(context, 1_320, 105, gain, 'sine');
        this.tone(context, 2_040, 85, gain * 0.55, 'sine', 6);
        break;
      case 'continuity_blip':
        this.tone(context, 440, 70, gain, 'sine');
        this.tone(context, 660, 85, gain, 'sine', 72);
        break;
      case 'domestic_sting':
        this.tone(context, 330, 190, gain, 'triangle');
        this.tone(context, 495, 180, gain * 0.75, 'triangle', 50);
        break;
      case 'knock':
        this.tone(context, 120, 55, gain, 'triangle');
        this.tone(context, 115, 55, gain * 0.9, 'triangle', 105);
        break;
      case 'mechanical_click':
        this.noise(context, 45, gain, scheduled.seed, 2_400);
        this.tone(context, 260, 70, gain * 0.6, 'square', 35, 210);
        break;
      case 'paper_rustle':
        this.noise(context, 155, gain, scheduled.seed, 2_100);
        break;
      case 'phone_chirp':
        this.tone(context, 440, 95, gain, 'sine');
        this.tone(context, 560, 95, gain, 'sine', 115);
        break;
      case 'teletype':
        for (let index = 0; index < 4; index += 1) {
          this.noise(context, 35, gain, scheduled.seed + index, 2_800, index * 52);
        }
        break;
      case 'tick':
        this.noise(context, 42, gain, scheduled.seed, 3_200);
        break;
      case 'tuning':
        this.noise(context, 150, gain, scheduled.seed, 1_900);
        this.tone(context, 210, 160, gain * 0.5, 'sine', 0, 620);
        break;
      case 'vhs_click':
        this.noise(context, 55, gain, scheduled.seed, 1_200);
        this.tone(context, 95, 90, gain * 0.7, 'square', 35, 70);
        break;
      case 'wood_tap':
        this.tone(context, 145, 110, gain, 'triangle', 0, 90);
        this.noise(context, 55, gain * 0.55, scheduled.seed, 750);
        break;
    }
  }
}
