export interface RunwayDescriptor {
  segmentId: string;
  channelId: string;
  programmeId: string;
  format: string;
  visualMedium: string;
  pacing: string;
  storyMode: string;
}

function energy(pacing: string): 'high' | 'medium' | 'low' {
  if (pacing === 'slow_burn' || pacing === 'near_silent') {
    return 'low';
  }
  if (pacing === 'conversational') {
    return 'medium';
  }
  return 'high';
}

function candidateScore(
  candidate: RunwayDescriptor,
  history: readonly RunwayDescriptor[],
  sourceIndex: number,
): number {
  const previous = history.at(-1);
  if (previous === undefined) {
    return -sourceIndex * 0.02;
  }

  let score = 0;
  score += candidate.programmeId === previous.programmeId ? -80 : 24;
  score += candidate.channelId === previous.channelId ? -50 : 16;
  score += candidate.format === previous.format ? -34 : 28;
  score += candidate.visualMedium === previous.visualMedium ? -30 : 24;
  score += candidate.pacing === previous.pacing ? -16 : 12;
  const candidateEnergy = energy(candidate.pacing);
  const previousEnergy = energy(previous.pacing);
  score += candidateEnergy === previousEnergy ? -6 : 10;
  if (candidateEnergy === 'low' && previousEnergy === 'low') {
    score -= 60;
  }

  const recent = history.slice(-3);
  if (!recent.some((item) => item.format === candidate.format)) {
    score += 12;
  }
  if (!recent.some((item) => item.visualMedium === candidate.visualMedium)) {
    score += 10;
  }
  if (!recent.some((item) => item.storyMode === candidate.storyMode)) {
    score += 5;
  }
  score -= sourceIndex * 0.02;
  return score;
}

export function diversifyRunway<T extends RunwayDescriptor>(
  candidates: readonly T[],
  preceding: RunwayDescriptor | null = null,
): T[] {
  const remaining = [...candidates];
  const result: T[] = [];
  const history: RunwayDescriptor[] = preceding === null ? [] : [preceding];

  while (remaining.length > 0) {
    let selectedIndex = 0;
    let selectedScore = Number.NEGATIVE_INFINITY;
    for (const [index, candidate] of remaining.entries()) {
      const score = candidateScore(candidate, history, index);
      if (score > selectedScore) {
        selectedIndex = index;
        selectedScore = score;
      }
    }
    const [selected] = remaining.splice(selectedIndex, 1);
    if (selected === undefined) {
      break;
    }
    result.push(selected);
    history.push(selected);
  }

  return result;
}

export function runwayDiversityMetrics(runway: readonly RunwayDescriptor[]): {
  sameFormatAdjacencies: number;
  sameMediumAdjacencies: number;
  samePacingAdjacencies: number;
  lowEnergyAdjacencies: number;
} {
  let sameFormatAdjacencies = 0;
  let sameMediumAdjacencies = 0;
  let samePacingAdjacencies = 0;
  let lowEnergyAdjacencies = 0;
  for (let index = 1; index < runway.length; index += 1) {
    const previous = runway[index - 1]!;
    const current = runway[index]!;
    sameFormatAdjacencies += Number(current.format === previous.format);
    sameMediumAdjacencies += Number(current.visualMedium === previous.visualMedium);
    samePacingAdjacencies += Number(current.pacing === previous.pacing);
    lowEnergyAdjacencies += Number(
      energy(current.pacing) === 'low' && energy(previous.pacing) === 'low',
    );
  }
  return {
    sameFormatAdjacencies,
    sameMediumAdjacencies,
    samePacingAdjacencies,
    lowEnergyAdjacencies,
  };
}
