const labelledStageDirectionPattern =
  /(?:\*[^*]+\*|^\s*(?:visual|camera|stage\s+direction|action)\s*:)/iu;

export function containsSpokenStageDirection(text: string): boolean {
  return (
    text.includes('[') ||
    text.includes(']') ||
    text.includes('(') ||
    text.includes(')') ||
    labelledStageDirectionPattern.test(text)
  );
}
