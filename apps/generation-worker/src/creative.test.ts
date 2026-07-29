import { describe, expect, it } from 'vitest';
import {
  assignedPacing,
  assignedStoryMode,
  demoDraft,
  scriptPrompt,
  systemPrompt,
  userPrompt,
} from './creative.js';

describe('generation prompts', () => {
  it('moves retries through different mandatory creative coordinates', () => {
    const prompts = [0, 4, 8, 12, 16, 20].map((index) =>
      userPrompt(
        index,
        ['Previous Programme'],
        ['A previous premise'],
        ['premise semantically repeats'],
      ),
    );

    const coordinateBlocks = prompts.map(
      (prompt) =>
        prompt.match(/Mandatory creative coordinates[\s\S]*?Use the format-specific frame/u)?.[0] ??
        '',
    );
    expect(new Set(coordinateBlocks).size).toBe(prompts.length);
    for (const prompt of prompts) {
      expect(prompt).toContain('Mandatory creative coordinates');
      expect(prompt).toContain('Physical setting:');
      expect(prompt).toContain('Format-specific comedy frame:');
      expect(prompt).toContain('Scope ceiling:');
      expect(prompt).toContain('Comedy mechanism family:');
      expect(prompt).toContain('Cast structure:');
      expect(prompt).toContain('Visual medium:');
      expect(prompt).toContain('Visual production grammar:');
      expect(prompt).toContain('Pacing:');
      expect(prompt).toContain('which role wants what');
      expect(prompt).not.toContain('Previous Programme');
      expect(prompt).not.toContain('A previous premise');
      expect(prompt).not.toContain('premise semantically repeats');
    }
    expect(
      prompts.some((prompt) => prompt.includes('Automatic set transformations are forbidden')),
    ).toBe(true);
  });

  it('asks for longer fragments that build useful broadcast duration', () => {
    expect(systemPrompt).toContain('6–12 short dialogue lines');
    expect(systemPrompt).toContain('30–120 second segment');
  });

  it('assigns pacing deterministically even when a provider omits it', () => {
    const first = assignedPacing(483_021);
    const storyMode = assignedStoryMode(483_021);
    expect(assignedPacing(483_021)).toBe(first);
    expect(userPrompt(483_021, [])).toContain(`Pacing: ${first}.`);
    expect(userPrompt(483_021, [])).toContain(`Story mode: ${storyMode}.`);
  });

  it('pairs every story mode with a compatible single comedy frame', () => {
    for (let serial = 0; serial < 140; serial += 1) {
      const prompt = userPrompt(serial, []);
      const frame = prompt.match(/Format-specific comedy frame: (.+)\n/u)?.[1] ?? '';
      const storyMode = assignedStoryMode(serial);
      const aligned =
        storyMode === 'product_consequence'
          ? /\bproduct\b/iu.test(frame)
          : storyMode === 'service_mismatch'
            ? /\b(?:customer|service)\b/iu.test(frame)
            : storyMode === 'status_transfer'
              ? /\b(?:authority|credit|promotion)\b/iu.test(frame)
              : storyMode === 'format_literalism'
                ? /\b(?:broadcast|bulletin|camera|caption|continuity|programme|warning)\b/iu.test(
                    frame,
                  )
                : storyMode === 'object_agency'
                  ? /\b(?:form|logo|map|object|product|receipt|talking)\b/iu.test(frame)
                  : storyMode === 'semantic_contract'
                    ? /\bphrase\b/iu.test(frame)
                    : storyMode === 'social_protocol'
                      ? /\b(?:custom|procedure|protocol)\b/iu.test(frame)
                      : /\bassigned visible trigger\b/iu.test(frame);
      expect(aligned, `${serial} ${storyMode}`).toBe(true);
    }
  });

  it('keeps stage directions out of spoken dialogue', () => {
    expect(userPrompt(12, [], [], [])).toContain('Mandatory creative coordinates');
    expect(scriptPrompt(demoDraft(0))).toContain(
      'never put stage directions, visual labels, bracketed actions',
    );
  });

  it('applies bounded half-hour feedback without exposing recent catalogue text', () => {
    const prompt = userPrompt(9, ['Private Recent Title'], ['Private recent premise'], [], {
      schemaVersion: 1,
      generatedAt: '2026-07-29T17:00:00.000Z',
      windowMinutes: 30,
      sampleSize: 18,
      scores: {
        premiseClarity: 7,
        comedyEscalation: 6,
        dialogueCoherence: 8,
        visualMatch: 7,
        paceVariety: 4,
        originality: 6,
        shareability: 5,
      },
      increaseFormats: ['sitcom'],
      increasePacing: ['near_silent'],
      avoidMotifs: ['balloons', 'cranes'],
      preserveStrengths: ['clear status reversals'],
      editorialDirection: 'Prefer small social stakes and earned visual reversals.',
      delivery: {
        isLive: true,
        concurrentViewers: 2,
        silenceRatio: 0.02,
        freezeRatio: 0.08,
        fallbackOccurrences: 0,
      },
    });

    expect(prompt).toContain('Thirty-minute editorial feedback');
    expect(prompt).toContain('balloons, cranes');
    expect(prompt).toContain('clear status reversals');
    expect(prompt).not.toContain('Private Recent Title');
    expect(prompt).not.toContain('Private recent premise');
  });
});
