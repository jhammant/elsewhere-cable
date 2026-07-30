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

export function successfulPlayedSegmentIds(logOutput: string): string[] {
  const pendingRequests = new Map<string, string>();
  const successful: string[] = [];
  for (const line of logOutput.split(/[\r\n]+/u)) {
    let record: {
      reqId?: unknown;
      req?: { method?: unknown; url?: unknown };
      res?: { statusCode?: unknown };
    };
    try {
      record = JSON.parse(line) as typeof record;
    } catch {
      continue;
    }
    const requestId = typeof record.reqId === 'string' ? record.reqId : null;
    const url = record.req?.url;
    const match =
      record.req?.method === 'GET' && typeof url === 'string'
        ? url.match(/^\/api\/playout\/segments\/(seg_[a-z0-9_]+)$/u)
        : null;
    if (requestId !== null && match !== null) {
      pendingRequests.set(requestId, match[1]!);
    }
    if (
      requestId !== null &&
      typeof record.res?.statusCode === 'number' &&
      record.res.statusCode >= 200 &&
      record.res.statusCode < 300
    ) {
      const segmentId = match?.[1] ?? pendingRequests.get(requestId);
      if (segmentId !== undefined) {
        successful.push(segmentId);
        pendingRequests.delete(requestId);
      }
    }
  }
  return [...new Set(successful)];
}
