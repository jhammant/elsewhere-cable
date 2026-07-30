import type { PlayoutManifest } from '@elsewhere-cable/schemas';

export interface LivePriorityResult {
  manifest: PlayoutManifest;
  reordered: boolean;
  insertedAfterSegmentId: string | null;
  prioritisedSegmentIds: string[];
}

export function prioritiseNewEntries(
  manifest: PlayoutManifest,
  currentSegmentId: string,
  newSegmentIds: readonly string[],
  lookahead: number,
): LivePriorityResult {
  const prioritisedIds = new Set(newSegmentIds);
  const priorityEntries = manifest.segments.filter((entry) => prioritisedIds.has(entry.segmentId));
  if (priorityEntries.length === 0) {
    return {
      manifest,
      reordered: false,
      insertedAfterSegmentId: null,
      prioritisedSegmentIds: [],
    };
  }

  const remaining = manifest.segments.filter((entry) => !prioritisedIds.has(entry.segmentId));
  const currentIndex = remaining.findIndex((entry) => entry.segmentId === currentSegmentId);
  if (currentIndex === -1) {
    return {
      manifest,
      reordered: false,
      insertedAfterSegmentId: null,
      prioritisedSegmentIds: priorityEntries.map((entry) => entry.segmentId),
    };
  }

  const insertionIndex = Math.min(currentIndex + 1 + lookahead, remaining.length);
  const nextSegments = [
    ...remaining.slice(0, insertionIndex),
    ...priorityEntries,
    ...remaining.slice(insertionIndex),
  ];
  const reordered = nextSegments.some(
    (entry, index) => entry.segmentId !== manifest.segments[index]?.segmentId,
  );

  return {
    manifest: reordered
      ? {
          ...manifest,
          generatedAt: new Date().toISOString(),
          segments: nextSegments,
        }
      : manifest,
    reordered,
    insertedAfterSegmentId: remaining[insertionIndex - 1]?.segmentId ?? null,
    prioritisedSegmentIds: priorityEntries.map((entry) => entry.segmentId),
  };
}
