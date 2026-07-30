import type { SegmentPackage } from '@elsewhere-cable/schemas';

export type FictionalBackgroundFamily =
  | 'aquatic_observatory'
  | 'celestial_interior'
  | 'civic_counter'
  | 'culinary_workroom'
  | 'domestic_room'
  | 'garden_enclosure'
  | 'laboratory'
  | 'newsroom'
  | 'sand_architecture'
  | 'showroom'
  | 'theatre'
  | 'transit_room';

const backgroundRules: ReadonlyArray<{
  family: FictionalBackgroundFamily;
  pattern: RegExp;
}> = [
  {
    family: 'aquatic_observatory',
    pattern: /\b(?:aquarium|coral|ferry|fish|kelp|ocean|pool|sea|tide|underwater|whale)\b/iu,
  },
  {
    family: 'celestial_interior',
    pattern: /\b(?:cloud|moon|orbit|planet|sky|star|sun)\b/iu,
  },
  {
    family: 'transit_room',
    pattern:
      /\b(?:bus|crossing|ferry|lift|platform|railway|roundabout|station|traffic|train|tram)\b/iu,
  },
  {
    family: 'garden_enclosure',
    pattern: /\b(?:garden|greenhouse|orchard|plant|shed|tree)\b/iu,
  },
  {
    family: 'theatre',
    pattern:
      /\b(?:band|cabaret|cinema|performance|puppet|rehearsal|stage|talent|theatre|trophy)\b/iu,
  },
  {
    family: 'laboratory',
    pattern: /\b(?:device|experiment|laboratory|machine|measurement|research|test)\b/iu,
  },
  {
    family: 'culinary_workroom',
    pattern: /\b(?:cook|food|ingredient|kitchen|meal|noodle|recipe|restaurant)\b/iu,
  },
  {
    family: 'sand_architecture',
    pattern: /\b(?:desert|dune|dust|oasis|sand)\b/iu,
  },
  {
    family: 'newsroom',
    pattern: /\b(?:bulletin|election|forecast|headline|news|report|weather)\b/iu,
  },
  {
    family: 'showroom',
    pattern: /\b(?:buy|customer|price|product|sale|shop|subscription)\b/iu,
  },
  {
    family: 'civic_counter',
    pattern: /\b(?:appeal|bureau|council|court|municipal|office|official|permit)\b/iu,
  },
];

export function resolveFictionalBackground(
  segment: Pick<SegmentPackage, 'programme'>,
): FictionalBackgroundFamily {
  const premise = segment.programme.premise;
  const matched = backgroundRules.find(({ pattern }) => pattern.test(premise));
  if (matched !== undefined) {
    return matched.family;
  }
  switch (segment.programme.format) {
    case 'news':
      return 'newsroom';
    case 'shopping':
    case 'advert':
      return 'showroom';
    case 'public_access':
    case 'emergency':
      return 'civic_counter';
    case 'ident':
      return 'theatre';
    case 'sitcom':
      return 'domestic_room';
  }
}
