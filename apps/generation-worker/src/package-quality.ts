import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { contentSafetyIssue } from './production.js';
import { unearnedEndingMechanisms } from './premise-critic.js';

const narratedPhysicalActionPattern =
  /^\s*(?:I am|I'm)\s+(?:catching|holding|looking|pointing|standing|walking|waving)\b/iu;
const genericPerilPattern =
  /\b(?:careful|crush(?:es|ed|ing)?|danger|do not touch|emergency hatch|forbidden zone|keep .{0,20} away|only exit|panic|scream(?:s|ed|ing)?|too late|trap(?:s|ped|ping)?|warning)\b/iu;
const ruleExpositionPattern =
  /\b(?:the rule|rules? (?:demand|force|say)|the law|law takes effect|contract terms|forces? (?:me|you|them|the)|is absolute|must obey)\b/iu;

export function legacyPackageQualityIssues(segment: SegmentPackage): string[] {
  const issues: string[] = [];
  const safetyIssue = contentSafetyIssue(segment);
  if (safetyIssue !== null) {
    issues.push(`legacy safety check rejected ${safetyIssue}`);
  }

  const speech = segment.events.filter((event) => event.type === 'speech.play');
  if (speech.length === 0) {
    return issues;
  }

  const narratedActions = speech.filter((event) =>
    narratedPhysicalActionPattern.test(event.subtitle),
  ).length;
  if (narratedActions >= 2) {
    issues.push('dialogue narrates physical stage actions instead of performing them');
  }

  const genericPerilLines = speech.filter((event) =>
    genericPerilPattern.test(event.subtitle),
  ).length;
  if (genericPerilLines >= Math.max(3, Math.ceil(speech.length / 2))) {
    issues.push('dialogue is dominated by generic peril rather than comic conflict');
  }

  const ruleExpositionLines = speech.filter((event) =>
    ruleExpositionPattern.test(event.subtitle),
  ).length;
  if (ruleExpositionLines >= Math.max(3, Math.ceil(speech.length / 2))) {
    issues.push('characters repeatedly explain the rule instead of pursuing a comic goal');
  }

  const dialogue = speech.map((event) => event.subtitle).join(' ');
  const unrelatedMechanisms = unearnedEndingMechanisms(segment.programme.premise, dialogue);
  if (unrelatedMechanisms.length >= 2) {
    issues.push(
      `dialogue introduces unrelated surreal mechanisms: ${unrelatedMechanisms.join(', ')}`,
    );
  }

  return issues;
}
