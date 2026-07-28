import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
  type SegmentEvent,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';
import { resolveProductionDesign } from './production-design.js';

interface PlayoutElements {
  broadcast: HTMLElement;
  channelNumber: HTMLElement;
  channelName: HTMLElement;
  formatBug: HTMLElement;
  graphic: HTMLElement;
  graphicKicker: HTMLElement;
  graphicText: HTMLElement;
  programmeTitle: HTMLElement;
  realityId: HTMLElement;
  nextTitle: HTMLElement;
  tickerText: HTMLElement;
  lowerChannelNumber: HTMLElement;
  lowerProgrammeTitle: HTMLElement;
  lowerStatus: HTMLElement;
  subtitle: HTMLElement;
  status: HTMLElement;
  mode: HTMLElement;
}

export interface PlayoutVisuals {
  loadSegment(segment: SegmentPackage): void;
  cutCamera(camera: 'CAMERA_WIDE' | 'CAMERA_HOST' | 'CAMERA_GUEST'): void;
  speak(characterId: string, durationMs: number): void;
  performAction(
    characterId: string,
    action:
      | 'IDLE'
      | 'ENTER'
      | 'EXIT'
      | 'LOOK_AT'
      | 'POINT_AT'
      | 'REACTION_NEUTRAL'
      | 'REACTION_CONFUSED'
      | 'REACTION_SHOCKED'
      | 'REACTION_ANGRY'
      | 'PAUSE'
      | 'FREEZE',
  ): void;
}

export function applyVisualEvent(event: SegmentEvent, visuals: PlayoutVisuals): void {
  switch (event.type) {
    case 'speech.play':
      visuals.speak(event.characterId, event.durationMs);
      break;
    case 'camera.cut':
      visuals.cutCamera(event.camera);
      break;
    case 'character.action':
      visuals.performAction(event.characterId, event.action);
      break;
    case 'graphic.show':
    case 'audio.static':
    case 'transition.play':
      break;
  }
}

function requiredElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Missing playout element: ${selector}`);
  }
  return element;
}

function elements(): PlayoutElements {
  return {
    broadcast: requiredElement('#broadcast'),
    channelNumber: requiredElement('#channel-number-value'),
    channelName: requiredElement('#channel-name'),
    formatBug: requiredElement('#format-bug'),
    graphic: requiredElement('#programme-graphic'),
    graphicKicker: requiredElement('#programme-graphic-kicker'),
    graphicText: requiredElement('#programme-graphic-text'),
    programmeTitle: requiredElement('#programme-title'),
    realityId: requiredElement('#reality-id'),
    nextTitle: requiredElement('#next-title'),
    tickerText: requiredElement('#ticker-text'),
    lowerChannelNumber: requiredElement('#lower-channel-number'),
    lowerProgrammeTitle: requiredElement('#lower-programme-title'),
    lowerStatus: requiredElement('#lower-status'),
    subtitle: requiredElement('#subtitle'),
    status: requiredElement('#playout-status'),
    mode: requiredElement('#playout-mode'),
  };
}

function segmentDirectory(packagePath: string): string {
  const separator = packagePath.lastIndexOf('/');
  return separator === -1 ? '' : packagePath.slice(0, separator);
}

export function nextUnplayedIndex(
  manifest: PlayoutManifest,
  startIndex: number,
  playedSegmentIds: ReadonlySet<string>,
): number | null {
  const offset = manifest.segments
    .slice(startIndex)
    .findIndex((candidate) => !playedSegmentIds.has(candidate.segmentId));
  return offset === -1 ? null : startIndex + offset;
}

export class PlayoutEngine {
  private readonly ui = elements();
  private manifest: PlayoutManifest | null = null;
  private index = 0;
  private readonly playedSegmentIds = new Set<string>();
  private fallbackSequence = 0;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private activeAudio: HTMLAudioElement | null = null;
  private audioUnlocked = false;

  constructor(private readonly visuals: PlayoutVisuals) {
    const parameters = new URLSearchParams(window.location.search);
    const requestedStart = Number(parameters.get('start') ?? 0);
    if (Number.isInteger(requestedStart) && requestedStart >= 0) {
      this.index = requestedStart;
    }
    if (parameters.has('broadcast')) {
      this.audioUnlocked = true;
      this.ui.mode.textContent = 'Unattended broadcast playout · audio enabled';
    }
    const unlock = (): void => {
      this.audioUnlocked = true;
      this.ui.status.textContent = 'Signal locked';
      this.ui.mode.textContent = 'Local generated playout · audio enabled';
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  async start(): Promise<void> {
    this.ui.mode.textContent = 'Connecting to prepared segment queue';
    try {
      const response = await fetch('/api/playout/manifest', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Manifest request failed with HTTP ${response.status}`);
      }
      this.manifest = playoutManifestSchema.parse(await response.json());
      if (this.manifest.segments.length === 0) {
        this.enterFallback('Prepared queue empty · showing fallback');
        return;
      }
      this.ui.mode.textContent = 'Local generated playout · click once for audio';
      await this.playCurrent();
    } catch (error) {
      this.enterFallback(error instanceof Error ? error.message : 'Manifest unavailable');
    }
  }

  private enterFallback(reason: string): void {
    this.ui.status.textContent = 'Fallback signal';
    this.ui.mode.textContent = reason;
    this.fallbackSequence += 1;
    const searchChannel = 40_000_000 + this.fallbackSequence * 104_729;
    const searchLabel = `SEARCHING CHANNEL ${searchChannel.toLocaleString('en-GB')}`;
    this.ui.channelNumber.textContent = String(searchChannel);
    this.ui.lowerChannelNumber.textContent = String(searchChannel);
    this.ui.channelName.textContent = 'Signal Not Previously Received';
    this.ui.programmeTitle.textContent = 'Scanning unbroadcast frequencies';
    this.ui.nextTitle.textContent = 'No repeat transmission authorised';
    this.ui.lowerProgrammeTitle.textContent = 'SEARCHING FOR NEW MATERIAL';
    this.ui.lowerStatus.textContent = searchLabel;
    this.ui.subtitle.textContent = 'This frequency has not been shown before.';
    this.staticBurst(1_200);
    this.timer(() => void this.start(), 10_000);
  }

  private timer(callback: () => void, delayMs: number): void {
    this.timers.push(setTimeout(callback, delayMs));
  }

  private clearSchedule(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
    this.activeAudio?.pause();
    this.activeAudio = null;
  }

  private async playCurrent(): Promise<void> {
    const manifest = this.manifest;
    if (manifest === null || manifest.segments.length === 0) {
      this.enterFallback('No approved segments available');
      return;
    }
    this.clearSchedule();
    const nextIndex = nextUnplayedIndex(manifest, this.index, this.playedSegmentIds);
    const entry = nextIndex === null ? undefined : manifest.segments[nextIndex];
    if (nextIndex === null || entry === undefined) {
      this.enterFallback('All prepared segments have aired once · awaiting new material');
      return;
    }
    this.index = nextIndex;

    try {
      const response = await fetch(`/api/playout/segments/${encodeURIComponent(entry.segmentId)}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Segment ${entry.segmentId} failed with HTTP ${response.status}`);
      }
      const segment = segmentPackageSchema.parse(await response.json());
      this.showSegment(segment, entry.packagePath);
      this.playedSegmentIds.add(entry.segmentId);
      this.index += 1;
      this.timer(() => void this.playCurrent(), segment.durationMs);
    } catch (error) {
      this.ui.status.textContent = 'Segment rejected';
      this.ui.lowerStatus.textContent =
        error instanceof Error ? error.message.slice(0, 80) : 'UNKNOWN SEGMENT ERROR';
      this.playedSegmentIds.add(entry.segmentId);
      this.index += 1;
      this.staticBurst();
      this.timer(() => void this.playCurrent(), 2_000);
    }
  }

  private showSegment(segment: SegmentPackage, packagePath: string): void {
    const manifest = this.manifest;
    const nextEntry =
      manifest === null || manifest.segments.length === 0
        ? null
        : manifest.segments
            .slice(this.index + 1)
            .find((entry) => !this.playedSegmentIds.has(entry.segmentId));
    const channel = String(segment.channel.number);
    const compactChannel = Number(segment.channel.number).toLocaleString('en-GB');
    this.ui.channelNumber.textContent = channel;
    this.ui.channelName.textContent = segment.channel.name;
    this.ui.programmeTitle.textContent = segment.programme.title;
    this.ui.realityId.textContent = segment.channel.realityId;
    this.ui.nextTitle.textContent = nextEntry?.programmeTitle ?? 'Signal origin disputed';
    this.ui.lowerChannelNumber.textContent = compactChannel;
    this.ui.lowerProgrammeTitle.textContent = segment.programme.title.toUpperCase();
    this.ui.lowerStatus.textContent = segment.programme.premise.toUpperCase().slice(0, 86);
    this.ui.subtitle.textContent = 'Programme already in progress.';
    this.ui.status.textContent = 'Signal locked';
    const productionDesign = resolveProductionDesign(segment);
    this.ui.broadcast.dataset.format = segment.programme.format;
    this.ui.broadcast.dataset.programme = segment.programme.id;
    this.ui.broadcast.dataset.channel = String(segment.channel.number);
    this.ui.broadcast.dataset.channelDigits = String(channel.length);
    this.ui.channelNumber.style.fontSize =
      channel.length >= 10
        ? 'clamp(0.72rem, 1.42vw, 1.28rem)'
        : channel.length >= 8
          ? 'clamp(0.82rem, 1.8vw, 1.62rem)'
          : channel.length >= 6
            ? 'clamp(1rem, 2.25vw, 2rem)'
            : '';
    this.ui.lowerChannelNumber.style.fontSize =
      channel.length >= 9
        ? 'clamp(0.38rem, 0.72vw, 0.68rem)'
        : channel.length >= 7
          ? 'clamp(0.44rem, 0.86vw, 0.78rem)'
          : '';
    this.ui.broadcast.dataset.medium = productionDesign.visualMedium;
    this.ui.broadcast.dataset.cast = productionDesign.castArchetype;
    this.ui.broadcast.dataset.pacing = segment.pacing ?? 'conversational';
    this.ui.formatBug.textContent =
      segment.channel.number === 113
        ? "CHILDREN'S TELEVISION"
        : segment.programme.format.replaceAll('_', ' ').toUpperCase();
    this.ui.tickerText.textContent = segment.programme.premise;
    this.ui.graphic.classList.remove('is-visible', 'is-warning');
    this.visuals.loadSegment(segment);
    this.staticBurst(620);

    const baseDirectory = segmentDirectory(packagePath);
    for (const event of segment.events) {
      this.timer(() => this.runEvent(event, baseDirectory), event.atMs);
    }
  }

  private runEvent(event: SegmentEvent, baseDirectory: string): void {
    applyVisualEvent(event, this.visuals);
    switch (event.type) {
      case 'speech.play':
        this.ui.subtitle.textContent = event.subtitle;
        this.ui.lowerStatus.textContent = `${event.characterName.toUpperCase()} · LIVE FROM ${this.ui.realityId.textContent ?? 'ELSEWHERE'}`;
        this.playSpeech(`/segments/${baseDirectory}/${event.audioFile}`);
        break;
      case 'graphic.show':
        this.showGraphic(event.graphic, event.text);
        break;
      case 'audio.static':
        this.staticBurst(event.durationMs);
        break;
      case 'transition.play':
        if (event.transition === 'STATIC_BURST' || event.transition === 'SIGNAL_LOSS') {
          this.staticBurst(event.transition === 'SIGNAL_LOSS' ? 1_200 : 480);
        }
        break;
      case 'camera.cut':
      case 'character.action':
        break;
    }
  }

  private showGraphic(graphic: 'LOWER_THIRD' | 'WARNING' | 'TITLE_CARD', text: string): void {
    const isWarning = graphic === 'WARNING';
    this.ui.graphicKicker.textContent = isWarning
      ? 'Signal event detected'
      : graphic === 'TITLE_CARD'
        ? 'The following programme has not yet happened'
        : 'Programme already in progress';
    this.ui.graphicText.textContent = text;
    this.ui.graphic.classList.toggle('is-warning', isWarning);
    this.ui.graphic.classList.add('is-visible');
    this.ui.lowerStatus.textContent = text.toUpperCase().slice(0, 100);
    if (isWarning) {
      this.staticBurst(280);
    }
    const pacing = this.ui.broadcast.dataset.pacing ?? 'conversational';
    const titleDuration =
      {
        frantic: 520,
        staccato: 850,
        conversational: 1_450,
        slow_burn: 2_300,
        interrupted: 920,
        near_silent: 2_900,
      }[pacing] ?? 1_450;
    this.timer(
      () => this.ui.graphic.classList.remove('is-visible'),
      isWarning ? Math.min(3_200, titleDuration + 900) : titleDuration,
    );
  }

  private playSpeech(url: string): void {
    this.activeAudio?.pause();
    const audio = new Audio(url);
    this.activeAudio = audio;
    if (!this.audioUnlocked) {
      this.ui.status.textContent = 'Click for audio';
    }
    void audio
      .play()
      .then(() => {
        this.audioUnlocked = true;
        this.ui.status.textContent = 'Signal locked';
        this.ui.mode.textContent = 'Local generated playout · audio active';
      })
      .catch(() => {
        this.ui.status.textContent = 'Click for audio';
      });
  }

  private staticBurst(durationMs = 480): void {
    this.ui.broadcast.classList.add('is-switching');
    this.timer(() => this.ui.broadcast.classList.remove('is-switching'), durationMs);
  }
}
