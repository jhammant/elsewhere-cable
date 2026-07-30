import type { SegmentPackage } from '@elsewhere-cable/schemas';

export interface ContinuityCopy {
  networkEyebrow: string;
  signalStatus: string;
  nowLabel: string;
  nextLabel: string;
  integrity: string;
  compatibility: string;
  graphicKickers: {
    lowerThird: string;
    titleCard: string;
    warning: string;
  };
}

const networkEyebrows = [
  'Signal received by Endor',
  'Unscheduled reception at Endor',
  'Endor frequency window open',
  'Carried across an unlisted reality',
  'Local receiver · non-local origin',
  'Endor has found another channel',
  'Transmission route unavailable',
  'Received somewhere after midnight',
  'Cross-reality cable service',
  'Origin address politely withheld',
  'Broadcast recovered out of sequence',
  'A neighbouring signal has arrived',
] as const;

const signalStatuses = [
  'Signal locked',
  'Reality approximately tuned',
  'Origin moving slowly',
  'Picture making its own arrangements',
  'Frequency temporarily cooperative',
  'Reception declared adequate',
  'Signal denies interference',
  'Carrier wave found indoors',
  'Transmission mostly facing forward',
  'Reality handshake incomplete',
  'Picture received before source',
  'Channel holding its position',
] as const;

const nowLabels = [
  'Now receiving',
  'Currently leaking through',
  'Already in progress',
  'Presently on this frequency',
  'Recovered programme',
  'On the channel at present',
  'Received without explanation',
  'This reality is showing',
  'Current accidental selection',
  'The receiver has chosen',
  'Broadcast found in transit',
  'On now, apparently',
] as const;

const nextLabels = [
  'Next, possibly',
  'After this, if available',
  'The receiver predicts',
  'Later on this or another channel',
  'Due next in one timeline',
  'Following programme disputed',
  'Coming up, origin permitting',
  'Next signal under consideration',
  'The schedule reluctantly suggests',
  'May follow without warning',
  'Subsequent reality',
  'Provisionally after this',
] as const;

const integrityLines = [
  'Emotionally stable',
  'Structurally embarrassed',
  'Temporarily self-consistent',
  'Accepting minor contradictions',
  'One detail ahead of itself',
  'Certified mostly present',
  'Under gentle administrative strain',
  'Holding together off camera',
  'Narratively load-bearing',
  'Stable when unobserved',
  'Locally plausible',
  'Pending a second opinion',
] as const;

const compatibilityLines = [
  'Viewer compatibility uncertain',
  'No compatible viewer has complained',
  'Please remain in your own reality',
  'Audience location not required',
  'Do not adjust your personal history',
  'Reception may alter small opinions',
  'Viewer recognised provisionally',
  'This channel cannot see your sofa',
  'Normal viewing rules may not apply',
  'Audience continuity not guaranteed',
  'Please keep both timelines open',
  'Suitable for unintended recipients',
] as const;

const lowerThirdKickers = [
  'Programme already in progress',
  'Received after the opening titles',
  'Local caption recovered',
  'This information arrived separately',
  'Programme identity provisional',
  'On-screen wording translated nearby',
] as const;

const titleCardKickers = [
  'The following programme has not yet happened',
  'This title was found without its schedule',
  'Programme name confirmed by furniture',
  'Recorded before the channel existed',
  'Opening title recovered from later',
  'This programme remembers beginning',
] as const;

const warningKickers = [
  'Harmless signal complication',
  'Minor reality service notice',
  'Administrative interruption detected',
  'The channel has filed an objection',
  'Non-urgent continuity discrepancy',
  'Broadcast procedure has become visible',
] as const;

function hash(value: string): number {
  let result = 2_166_136_261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

function select<const Values extends readonly string[]>(
  segment: SegmentPackage,
  salt: string,
  values: Values,
): Values[number] {
  const seed = [
    segment.segmentId,
    segment.channel.number,
    segment.programme.id,
    segment.visualMedium ?? segment.visualStyle,
    salt,
  ].join(':');
  return values[hash(seed) % values.length]!;
}

export function continuityCopyForSegment(segment: SegmentPackage): ContinuityCopy {
  return {
    networkEyebrow: select(segment, 'network-eyebrow', networkEyebrows),
    signalStatus: select(segment, 'signal-status', signalStatuses),
    nowLabel: select(segment, 'now-label', nowLabels),
    nextLabel: select(segment, 'next-label', nextLabels),
    integrity: select(segment, 'integrity', integrityLines),
    compatibility: select(segment, 'compatibility', compatibilityLines),
    graphicKickers: {
      lowerThird: select(segment, 'lower-third-kicker', lowerThirdKickers),
      titleCard: select(segment, 'title-card-kicker', titleCardKickers),
      warning: select(segment, 'warning-kicker', warningKickers),
    },
  };
}
