import {
  playoutManifestSchema,
  segmentPackageSchema,
  type PlayoutManifest,
  type PlayoutObservation,
  type SegmentEvent,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';
import { continuityCopyForSegment, type ContinuityCopy } from './continuity-copy.js';
import { resolveBroadcastPackage, type BroadcastPackage } from './broadcast-package.js';
import { resolveProductionDesign } from './production-design.js';
import {
  BroadcastSoundDesigner,
  soundCuesForSegment,
  type ScheduledSoundCue,
} from './sound-design.js';
import {
  assertTitleSequenceFramesComplete,
  resolveTitleSequenceGrammar,
  titleSequenceFrame,
} from './title-sequence.js';
import { BroadcastVisualEffects } from './visual-effects.js';

interface PlayoutElements {
  broadcast: HTMLElement;
  networkEyebrow: HTMLElement;
  channelNumber: HTMLElement;
  channelName: HTMLElement;
  nowLabel: HTMLElement;
  integrity: HTMLElement;
  compatibility: HTMLElement;
  formatBug: HTMLElement;
  graphic: HTMLElement;
  graphicKicker: HTMLElement;
  graphicText: HTMLElement;
  graphicMeta: HTMLElement;
  programmeTitle: HTMLElement;
  realityId: HTMLElement;
  nextLabel: HTMLElement;
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
  performStoryCue(cue: ScheduledSoundCue): void;
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
    networkEyebrow: requiredElement('#network-eyebrow'),
    channelNumber: requiredElement('#channel-number-value'),
    channelName: requiredElement('#channel-name'),
    nowLabel: requiredElement('#now-label'),
    integrity: requiredElement('#integrity-status'),
    compatibility: requiredElement('#compatibility-notice'),
    formatBug: requiredElement('#format-bug'),
    graphic: requiredElement('#programme-graphic'),
    graphicKicker: requiredElement('#programme-graphic-kicker'),
    graphicText: requiredElement('#programme-graphic-text'),
    graphicMeta: requiredElement('#programme-graphic-meta'),
    programmeTitle: requiredElement('#programme-title'),
    realityId: requiredElement('#reality-id'),
    nextLabel: requiredElement('#next-label'),
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
  for (let offset = 0; offset < manifest.segments.length; offset += 1) {
    const index = (startIndex + offset) % manifest.segments.length;
    const candidate = manifest.segments[index];
    if (candidate !== undefined && !playedSegmentIds.has(candidate.segmentId)) {
      return index;
    }
  }
  return null;
}

export function segmentObservation(
  event: 'segment.started' | 'segment.completed',
  occurrenceId: string,
  segment: SegmentPackage,
): PlayoutObservation {
  const design = resolveProductionDesign(segment);
  return {
    schemaVersion: 1,
    occurrenceId,
    observedAt: new Date().toISOString(),
    event,
    segmentId: segment.segmentId,
    channelNumber: segment.channel.number,
    channelName: segment.channel.name,
    programmeId: segment.programme.id,
    programmeTitle: segment.programme.title,
    format: segment.programme.format,
    visualMedium: design.visualMedium,
    pacing: segment.pacing ?? 'conversational',
    durationMs: segment.durationMs,
  };
}

export class PlayoutEngine {
  private static readonly broadcastHistoryKey = 'elsewhere-cable.played-segments.v1';
  private readonly ui = elements();
  private manifest: PlayoutManifest | null = null;
  private index = 0;
  private readonly playedSegmentIds = new Set<string>();
  private fallbackSequence = 0;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private activeAudio: HTMLAudioElement | null = null;
  private audioUnlocked = false;
  private readonly soundDesigner: BroadcastSoundDesigner;
  private readonly visualEffects: BroadcastVisualEffects;
  private persistPlaybackHistory = false;
  private graphicKickers: ContinuityCopy['graphicKickers'] = {
    lowerThird: 'Programme already in progress',
    titleCard: 'The following programme has not yet happened',
    warning: 'Signal event detected',
  };

  constructor(private readonly visuals: PlayoutVisuals) {
    assertTitleSequenceFramesComplete();
    this.soundDesigner = new BroadcastSoundDesigner(() => this.audioUnlocked);
    this.visualEffects = new BroadcastVisualEffects(requiredElement('#story-visual-effect'));
    const parameters = new URLSearchParams(window.location.search);
    const requestedStart = Number(parameters.get('start') ?? 0);
    if (Number.isInteger(requestedStart) && requestedStart >= 0) {
      this.index = requestedStart;
    }
    if (parameters.has('broadcast')) {
      this.persistPlaybackHistory = true;
      this.restorePlaybackHistory();
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
      await this.refreshManifest();
      const manifest = this.manifest;
      if (manifest === null || manifest.segments.length === 0) {
        this.enterFallback('Prepared queue empty · showing fallback');
        return;
      }
      this.ui.mode.textContent = 'Local generated playout · click once for audio';
      await this.playCurrent();
    } catch (error) {
      this.enterFallback(error instanceof Error ? error.message : 'Manifest unavailable');
    }
  }

  private async refreshManifest(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch('/api/playout/manifest', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Manifest request failed with HTTP ${response.status}`);
      }
      this.manifest = playoutManifestSchema.parse(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }

  private enterFallback(reason: string): void {
    this.reportObservation({
      schemaVersion: 1,
      occurrenceId: crypto.randomUUID(),
      observedAt: new Date().toISOString(),
      event: 'fallback.started',
      reason: reason.slice(0, 200),
    });
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
    this.soundDesigner.reset();
  }

  private async playCurrent(): Promise<void> {
    this.clearSchedule();
    try {
      await this.refreshManifest();
    } catch {
      // Keep airing the last atomic manifest if the local control API briefly drops out.
    }
    const manifest = this.manifest;
    if (manifest === null || manifest.segments.length === 0) {
      this.enterFallback('No approved segments available');
      return;
    }
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
      const occurrenceId = crypto.randomUUID();
      this.showSegment(segment, entry.packagePath);
      this.markPlayed(entry.segmentId);
      this.reportObservation(segmentObservation('segment.started', occurrenceId, segment));
      this.index += 1;
      this.timer(() => {
        this.reportObservation(segmentObservation('segment.completed', occurrenceId, segment));
        void this.playCurrent();
      }, segment.durationMs);
    } catch (error) {
      this.reportObservation({
        schemaVersion: 1,
        occurrenceId: crypto.randomUUID(),
        observedAt: new Date().toISOString(),
        event: 'segment.failed',
        segmentId: entry.segmentId,
        reason: (error instanceof Error ? error.message : 'Unknown segment error').slice(0, 200),
      });
      this.ui.status.textContent = 'Segment rejected';
      this.ui.lowerStatus.textContent =
        error instanceof Error ? error.message.slice(0, 80) : 'UNKNOWN SEGMENT ERROR';
      this.markPlayed(entry.segmentId);
      this.index += 1;
      this.staticBurst();
      this.timer(() => void this.playCurrent(), 2_000);
    }
  }

  private reportObservation(observation: PlayoutObservation): void {
    void fetch('/api/playout/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(observation),
      keepalive: true,
    }).catch(() => {
      // Observability must never interrupt playout.
    });
  }

  private restorePlaybackHistory(): void {
    try {
      const stored = localStorage.getItem(PlayoutEngine.broadcastHistoryKey);
      if (stored === null) {
        return;
      }
      const segmentIds: unknown = JSON.parse(stored);
      if (!Array.isArray(segmentIds)) {
        return;
      }
      for (const segmentId of segmentIds) {
        if (typeof segmentId === 'string' && /^seg_[a-z0-9_]+$/u.test(segmentId)) {
          this.playedSegmentIds.add(segmentId);
        }
      }
    } catch {
      // Corrupt browser state must never interrupt broadcast playout.
    }
  }

  private markPlayed(segmentId: string): void {
    this.playedSegmentIds.add(segmentId);
    if (!this.persistPlaybackHistory) {
      return;
    }
    try {
      localStorage.setItem(
        PlayoutEngine.broadcastHistoryKey,
        JSON.stringify([...this.playedSegmentIds]),
      );
    } catch {
      // A full or unavailable browser store degrades to this session's in-memory history.
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
    const continuityCopy = continuityCopyForSegment(segment);
    this.graphicKickers = continuityCopy.graphicKickers;
    this.ui.networkEyebrow.textContent = continuityCopy.networkEyebrow;
    this.ui.status.textContent = continuityCopy.signalStatus;
    this.ui.nowLabel.textContent = continuityCopy.nowLabel;
    this.ui.nextLabel.textContent = continuityCopy.nextLabel;
    this.ui.integrity.textContent = continuityCopy.integrity;
    this.ui.compatibility.textContent = continuityCopy.compatibility;
    this.ui.channelNumber.textContent = channel;
    this.ui.channelName.textContent = segment.channel.name;
    this.ui.programmeTitle.textContent = segment.programme.title;
    this.ui.realityId.textContent = segment.channel.realityId;
    this.ui.nextTitle.textContent = nextEntry?.programmeTitle ?? 'Signal origin disputed';
    this.ui.lowerChannelNumber.textContent = compactChannel;
    this.ui.lowerProgrammeTitle.textContent = segment.programme.title.toUpperCase();
    this.ui.lowerStatus.textContent = segment.programme.premise.toUpperCase().slice(0, 86);
    this.ui.subtitle.textContent = 'Programme already in progress.';
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
    const broadcastPackage = resolveBroadcastPackage({
      ...segment,
      visualMedium: productionDesign.visualMedium,
    });
    this.ui.broadcast.dataset.package = broadcastPackage;
    this.ui.broadcast.dataset.titleSequence = resolveTitleSequenceGrammar({
      ...segment,
      visualMedium: productionDesign.visualMedium,
    });
    this.applyTitleSequenceFrame(broadcastPackage);
    this.ui.graphicMeta.textContent = `CH ${compactChannel} · ${segment.channel.realityId}`;
    this.ui.formatBug.textContent =
      segment.channel.number === 113
        ? "CHILDREN'S TELEVISION"
        : segment.programme.format.replaceAll('_', ' ').toUpperCase();
    this.ui.tickerText.textContent = segment.programme.premise;
    this.ui.graphic.classList.remove('is-visible', 'is-warning');
    this.visuals.loadSegment(segment);
    this.visualEffects.loadSegment(segment);
    this.staticBurst(620);

    const baseDirectory = segmentDirectory(packagePath);
    for (const event of segment.events) {
      this.timer(() => this.runEvent(event, baseDirectory), event.atMs);
    }
    for (const soundCue of soundCuesForSegment(segment)) {
      this.timer(() => {
        this.soundDesigner.play(soundCue);
        this.visuals.performStoryCue(soundCue);
        this.visualEffects.play(soundCue);
      }, soundCue.atMs);
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
    this.ui.graphic.dataset.kind = graphic;
    this.ui.graphicKicker.textContent = isWarning
      ? this.graphicKickers.warning
      : graphic === 'TITLE_CARD'
        ? this.graphicKickers.titleCard
        : this.graphicKickers.lowerThird;
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

  private applyTitleSequenceFrame(broadcastPackage: BroadcastPackage): void {
    const frame = titleSequenceFrame(broadcastPackage);
    this.ui.graphic.style.setProperty('--title-left', `${frame.leftPercent}%`);
    this.ui.graphic.style.setProperty('--title-right', `${frame.rightPercent}%`);
    this.ui.graphic.style.setProperty('--title-top', `${frame.topPercent}%`);
    this.ui.graphic.style.setProperty('--title-height', `${frame.heightPercent}%`);
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
