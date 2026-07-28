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
      (prompt) => prompt.match(/Mandatory creative coordinates[\s\S]*?Use all seven/u)?.[0] ?? '',
    );
    expect(new Set(coordinateBlocks).size).toBe(prompts.length);
    for (const prompt of prompts) {
      expect(prompt).toContain('Mandatory creative coordinates');
      expect(prompt).toContain('Physical setting:');
      expect(prompt).toContain('Comic trigger:');
      expect(prompt).toContain('Physical consequence:');
      expect(prompt).toContain('Character conflict:');
      expect(prompt).toContain('Cast structure:');
      expect(prompt).toContain('Visual medium:');
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
});
