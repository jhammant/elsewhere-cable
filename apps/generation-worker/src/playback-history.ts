const segmentIdPattern = /^seg_[a-z0-9_]+$/u;

export function retainedPlayedSegmentIds(
  existing: readonly string[],
  observed: readonly string[],
): string[] {
  return [
    ...new Set(
      [...existing, ...observed]
        .map((segmentId) => segmentId.trim())
        .filter((segmentId) => segmentIdPattern.test(segmentId)),
    ),
  ];
}
