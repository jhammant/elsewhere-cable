import { describe, expect, it } from 'vitest';
import { demoDraft, scriptPrompt, systemPrompt, userPrompt } from './creative.js';

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
        prompt.match(/Mandatory creative coordinates[\s\S]*?Fuse the story engine/u)?.[0] ?? '',
    );
    expect(new Set(coordinateBlocks).size).toBe(prompts.length);
    for (const prompt of prompts) {
      expect(prompt).toContain('Mandatory creative coordinates');
      expect(prompt).toContain('Physical setting:');
      expect(prompt).toContain('Story engine:');
      expect(prompt).toContain('Story scale:');
      expect(prompt).toContain('Comic trigger:');
      expect(prompt).toContain('Affected set element:');
      expect(prompt).toContain('Transformation:');
      expect(prompt).toContain('Escalation rhythm:');
      expect(prompt).toContain('Character conflict:');
      expect(prompt).toContain('Cast structure:');
      expect(prompt).toContain('Visual medium:');
      expect(prompt).toContain('Visual production grammar:');
      expect(prompt).toContain('Pacing:');
      expect(prompt).not.toContain('Previous Programme');
      expect(prompt).not.toContain('A previous premise');
      expect(prompt).not.toContain('premise semantically repeats');
    }
  });

  it('asks for longer fragments that build useful broadcast duration', () => {
    expect(systemPrompt).toContain('6–12 short dialogue lines');
    expect(systemPrompt).toContain('30–120 second segment');
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
