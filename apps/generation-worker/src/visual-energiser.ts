import {
  segmentPackageSchema,
  type SegmentEvent,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';

type Pacing = NonNullable<SegmentPackage['pacing']>;

export interface VisualEnergiserResult {
  segment: SegmentPackage;
  cameraEventsAdded: number;
  graphicEventsAdded: number;
  staticEventsAdded: number;
  repairedGraphics: number;
  pacingChanged: boolean;
}

const pacingCycle: readonly Pacing[] = [
  'frantic',
  'conversational',
  'staccato',
  'interrupted',
  'slow_burn',
  'frantic',
  'staccato',
  'near_silent',
];

const graphicSpacingMs: Record<Pacing, number> = {
  frantic: 4_800,
  staccato: 5_800,
  conversational: 7_200,
  slow_burn: 9_500,
  interrupted: 5_400,
  near_silent: 10_000,
};

function graphicForFormat(
  format: SegmentPackage['programme']['format'],
): 'LOWER_THIRD' | 'WARNING' | 'TITLE_CARD' {
  switch (format) {
    case 'advert':
    case 'ident':
    case 'sitcom':
      return 'TITLE_CARD';
    case 'emergency':
    case 'public_access':
      return 'WARNING';
    case 'news':
    case 'shopping':
      return 'LOWER_THIRD';
  }
}

const graphicLabels: Record<SegmentPackage['programme']['format'], readonly string[]> = {
  advert: ['PRODUCT CLAIM', 'FINE PRINT', 'TESTIMONIAL'],
  emergency: ['INSTRUCTION', 'STATUS REVISION', 'REMAIN CALM'],
  ident: ['TRANSMISSION', 'HANDOVER', 'SIGN-OFF'],
  news: ['ON RECORD', 'LIVE CORRECTION', 'DEVELOPING'],
  public_access: ['CASE FILE', 'CALLER RECORD', 'DECISION'],
  shopping: ['LIVE DEMO', 'OFFER STATUS', 'DEMO RESULT'],
  sitcom: ['IN THIS ROOM', 'AFTER THAT', 'HOUSEHOLD UPDATE'],
};

function excerpt(text: string, maximumLength: number): string {
  const normalised = text.replace(/\s+/gu, ' ').trim();
  if (normalised.length <= maximumLength) {
    return normalised;
  }
  const candidate = normalised.slice(0, maximumLength);
  const lastSpace = candidate.lastIndexOf(' ');
  const boundary = lastSpace >= maximumLength * 0.7 ? lastSpace : candidate.length;
  return `${candidate.slice(0, boundary).trimEnd()}…`;
}

export function editorialGraphicText(
  segment: SegmentPackage,
  speech: Extract<SegmentEvent, { type: 'speech.play' }>,
  speechIndex: number,
): string {
  const labels = graphicLabels[segment.programme.format];
  const label = labels[speechIndex % labels.length]!;
  const sequence = String(speechIndex + 1).padStart(2, '0');
  return `${label} ${sequence} · ${excerpt(speech.characterName.toUpperCase(), 32)} / ${excerpt(
    speech.subtitle,
    78,
  )}`;
}

function closestPrecedingSpeech(
  speech: readonly Extract<SegmentEvent, { type: 'speech.play' }>[],
  atMs: number,
): Extract<SegmentEvent, { type: 'speech.play' }> | undefined {
  return speech.filter((event) => event.atMs <= atMs).at(-1) ?? speech[0];
}

function cameraEventsForSpeech(
  speech: Extract<SegmentEvent, { type: 'speech.play' }>,
  pacing: Pacing,
  speakerIndex: number,
  existingEvents: readonly SegmentEvent[],
): SegmentEvent[] {
  if (speech.durationMs < 2_400 || pacing === 'slow_burn' || pacing === 'near_silent') {
    return [];
  }
  const cuts =
    pacing === 'frantic' && speech.durationMs >= 3_600
      ? [
          { fraction: 0.32, camera: 'CAMERA_WIDE' as const },
          {
            fraction: 0.7,
            camera: speakerIndex % 2 === 0 ? ('CAMERA_GUEST' as const) : ('CAMERA_HOST' as const),
          },
        ]
      : [{ fraction: 0.54, camera: 'CAMERA_WIDE' as const }];
  return cuts
    .map(({ fraction, camera }) => ({
      atMs: speech.atMs + Math.floor(speech.durationMs * fraction),
      type: 'camera.cut' as const,
      camera,
    }))
    .filter(
      (candidate) =>
        !existingEvents.some(
          (event) => event.type === 'camera.cut' && Math.abs(event.atMs - candidate.atMs) < 650,
        ),
    );
}

export function remixedPacing(index: number): Pacing {
  return pacingCycle[index % pacingCycle.length]!;
}

export function energiseVisualTimeline(
  segment: SegmentPackage,
  options: {
    pacing?: Pacing;
    repairGraphics?: boolean;
    addStatic?: boolean;
  } = {},
): VisualEnergiserResult {
  const pacing = options.pacing ?? segment.pacing ?? 'conversational';
  const speech = segment.events
    .filter(
      (event): event is Extract<SegmentEvent, { type: 'speech.play' }> =>
        event.type === 'speech.play',
    )
    .sort((left, right) => left.atMs - right.atMs);
  const desiredGraphic = graphicForFormat(segment.programme.format);
  let repairedGraphics = 0;
  const repairedEvents = segment.events.map((event) => {
    if (event.type !== 'graphic.show' || event.atMs <= 1_000) {
      return event;
    }
    const precedingSpeech = closestPrecedingSpeech(speech, event.atMs);
    if (precedingSpeech === undefined) {
      return event;
    }
    const nextText =
      options.repairGraphics === true
        ? editorialGraphicText(segment, precedingSpeech, speech.indexOf(precedingSpeech))
        : event.text;
    if (event.graphic === desiredGraphic && event.text === nextText) {
      return event;
    }
    repairedGraphics += 1;
    return {
      ...event,
      graphic: desiredGraphic,
      text: nextText,
    };
  });

  const cameraAdditions = speech.flatMap((event, index) =>
    cameraEventsForSpeech(event, pacing, index, repairedEvents),
  );
  const graphicTimes = repairedEvents
    .filter((event) => event.type === 'graphic.show')
    .map((event) => event.atMs)
    .sort((left, right) => left - right);
  const graphicAdditions: SegmentEvent[] = [];
  const staticAdditions: SegmentEvent[] = [];
  let lastGraphicAt = graphicTimes[0] ?? 0;
  for (const line of speech) {
    if (
      line.atMs < 2_000 ||
      line.atMs >= segment.durationMs - 1_500 ||
      line.atMs - lastGraphicAt < graphicSpacingMs[pacing]
    ) {
      continue;
    }
    const atMs = line.atMs + Math.min(420, Math.floor(line.durationMs * 0.16));
    if (
      graphicTimes.some((existingAtMs) => Math.abs(existingAtMs - atMs) < 2_000) ||
      graphicAdditions.some(
        (event) => event.type === 'graphic.show' && Math.abs(event.atMs - atMs) < 2_000,
      )
    ) {
      continue;
    }
    graphicAdditions.push({
      atMs,
      type: 'graphic.show',
      graphic: desiredGraphic,
      text: editorialGraphicText(segment, line, speech.indexOf(line)),
    });
    if (options.addStatic !== false) {
      staticAdditions.push({
        atMs: Math.max(0, atMs - 180),
        type: 'audio.static',
        durationMs: 140,
      });
    }
    lastGraphicAt = atMs;
  }

  return {
    segment: segmentPackageSchema.parse({
      ...segment,
      pacing,
      events: [...repairedEvents, ...cameraAdditions, ...graphicAdditions, ...staticAdditions].sort(
        (left, right) => left.atMs - right.atMs,
      ),
    }),
    cameraEventsAdded: cameraAdditions.length,
    graphicEventsAdded: graphicAdditions.length,
    staticEventsAdded: staticAdditions.length,
    repairedGraphics,
    pacingChanged: pacing !== (segment.pacing ?? 'conversational'),
  };
}
