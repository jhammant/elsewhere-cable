export function rotateCatalogue<T>(items: readonly T[], offset: number): T[] {
  if (items.length === 0) {
    return [];
  }
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export function mixedRecoveryCatalogue<T>(
  approvedOriginals: readonly T[],
  stableDemos: readonly T[],
  offset: number,
): T[] {
  if (approvedOriginals.length === 0) {
    return rotateCatalogue(stableDemos, offset);
  }
  if (stableDemos.length === 0) {
    return rotateCatalogue(approvedOriginals, offset);
  }

  const mixed: T[] = [];
  let originalIndex = 0;
  let demoIndex = 0;

  while (originalIndex < approvedOriginals.length || demoIndex < stableDemos.length) {
    for (
      let index = 0;
      index < 3 && originalIndex < approvedOriginals.length;
      index += 1
    ) {
      mixed.push(approvedOriginals[originalIndex]!);
      originalIndex += 1;
    }
    if (demoIndex < stableDemos.length) {
      mixed.push(stableDemos[demoIndex]!);
      demoIndex += 1;
    }
  }

  return rotateCatalogue(mixed, offset);
}
