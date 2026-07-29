const labelledStageDirectionPattern =
  /(?:\*[^*]+\*|^\s*(?:visual|camera|stage\s+direction|action)\s*:)/iu;
const narratedCameraDirectionPattern =
  /^\s*(?:(?:the\s+)?camera\s+(?:cuts?|pans?|zooms?|switches?|moves?|holds?)\b|(?:cut|pan|zoom|fade)(?:\s+to)?\b)/iu;

export function containsSpokenStageDirection(text: string): boolean {
  return (
    text.includes('[') ||
    text.includes(']') ||
    text.includes('(') ||
    text.includes(')') ||
    labelledStageDirectionPattern.test(text) ||
    narratedCameraDirectionPattern.test(text)
  );
}
