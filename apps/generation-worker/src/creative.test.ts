import { describe, expect, it } from 'vitest';
import {
  assignedDialogueShape,
  assignedDialogueShapeForCoordinates,
  assignedPacing,
  assignedStoryMode,
  demoDraft,
  dialogueArchitectureIssues,
  dialogueSpeakerPattern,
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
      expect(prompt).toContain('Television-format anchor:');
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
      expect(prompt).toContain('catalogue-novel objective, mechanism and consequence');
    }
    expect(
      prompts.some((prompt) => prompt.includes('Automatic set transformations are forbidden')),
    ).toBe(true);
  });

  it('asks for longer fragments that build useful broadcast duration', () => {
    expect(systemPrompt).toContain('6–12 short dialogue lines');
    expect(systemPrompt).toContain('30–120 second segment');
  });

  it('draws locations and casts from broad production pools', () => {
    const prompts = Array.from({ length: 420 }, (_, serial) => userPrompt(serial, []));
    const locations = prompts.map(
      (prompt) => prompt.match(/Physical setting: (.+)\.\n/u)?.[1] ?? '',
    );
    const casts = prompts.map((prompt) => prompt.match(/Cast structure: (.+)\.\n/u)?.[1] ?? '');

    expect(new Set(locations).size).toBeGreaterThan(28);
    expect(new Set(casts).size).toBeGreaterThan(30);
  });

  it('assigns pacing deterministically even when a provider omits it', () => {
    const first = assignedPacing(483_021);
    const storyMode = assignedStoryMode(483_021);
    expect(assignedPacing(483_021)).toBe(first);
    expect(userPrompt(483_021, [])).toContain(`Pacing: ${first}.`);
    expect(userPrompt(483_021, [])).toContain(`Story mode: ${storyMode}.`);
  });

  it('varies dialogue architecture instead of defaulting to equal two-person exchanges', () => {
    const shapes = Array.from({ length: 120 }, (_, serial) =>
      assignedDialogueShape(800_000_000 + serial * 104_729),
    );

    expect(new Set(shapes).size).toBe(12);
    expect(assignedDialogueShape(847_291_035)).toBe(assignedDialogueShape(847_291_035));
    const draft = demoDraft(0);
    const coordinateShape = assignedDialogueShapeForCoordinates(draft);
    expect(userPrompt(483_021, [])).toContain('Dialogue architecture:');
    expect(scriptPrompt(draft)).toContain(`Dialogue architecture: ${coordinateShape}`);
    expect(shapes.some((shape) => shape.includes('never use rigid ABAB'))).toBe(true);
    expect(shapes.some((shape) => shape.includes('four to six lines'))).toBe(true);
    expect(dialogueSpeakerPattern('Unequal exchange: test')).toBe('A, A, B, A, B, B');
    expect(scriptPrompt(draft)).toContain('Required speaker rhythm:');
  });

  it('covers every dialogue architecture across proposal coordinates', () => {
    const formats = [
      'advert',
      'public_access',
      'news',
      'shopping',
      'sitcom',
      'emergency',
      'ident',
    ] as const;
    const media = [
      'cel_shaded',
      'paper_cutout',
      'pixel_broadcast',
      'archive_film',
      'neon_wireframe',
      'public_access_vhs',
      'signal_corruption',
      'stop_motion',
      'collage_zine',
      'ink_monochrome',
      'miniature_diorama',
      'corporate_vector',
      'claymation',
      'shadow_theatre',
      'hand_drawn',
      'thermal_camera',
      'ascii_terminal',
      'blueprint_schematic',
      'stained_glass',
      'xerox_punk',
      'storybook_wash',
      'isometric_manual',
    ] as const;
    const shapes = formats.flatMap((format) =>
      media.flatMap((visualMedium) =>
        (
          [
            'frantic',
            'staccato',
            'conversational',
            'slow_burn',
            'interrupted',
            'near_silent',
          ] as const
        ).map((pacing) =>
          assignedDialogueShapeForCoordinates({
            format,
            visualMedium,
            storyMode: 'status_transfer',
            pacing,
          }),
        ),
      ),
    );

    expect(new Set(shapes).size).toBe(12);
    const franticShapes = formats.flatMap((format) =>
      media.map((visualMedium) =>
        assignedDialogueShapeForCoordinates({
          format,
          visualMedium,
          storyMode: 'status_transfer',
          pacing: 'frantic',
        }),
      ),
    );
    const nearSilentShapes = formats.flatMap((format) =>
      media.map((visualMedium) =>
        assignedDialogueShapeForCoordinates({
          format,
          visualMedium,
          storyMode: 'status_transfer',
          pacing: 'near_silent',
        }),
      ),
    );
    expect(franticShapes.some((shape) => shape.startsWith('Sparse reaction scene:'))).toBe(false);
    expect(nearSilentShapes.some((shape) => shape.startsWith('Rapid corrections:'))).toBe(false);
  });

  it('turns selected dialogue architectures into enforceable cadence gates', () => {
    const base = demoDraft(4);
    const coordinateOptions = (
      [
        'cel_shaded',
        'paper_cutout',
        'pixel_broadcast',
        'archive_film',
        'neon_wireframe',
        'signal_corruption',
        'stop_motion',
        'claymation',
        'thermal_camera',
      ] as const
    ).map((visualMedium) => ['advert', visualMedium, 'object_agency', 'conversational'] as const);
    const unequalCoordinates = coordinateOptions.find(([format, visualMedium, storyMode, pacing]) =>
      assignedDialogueShapeForCoordinates({
        format,
        visualMedium,
        storyMode,
        pacing,
      }).startsWith('Unequal exchange:'),
    );
    expect(unequalCoordinates).toBeDefined();
    const [format, visualMedium, storyMode, pacing] = unequalCoordinates!;
    const rigid = {
      ...base,
      format,
      visualMedium,
      storyMode,
      pacing,
      dialogue: Array.from({ length: 8 }, (_, index) => ({
        speaker: index % 2 === 0 ? 'Host' : 'Guest',
        text: 'This is a short responsive spoken line.',
        action: 'REACTION_NEUTRAL' as const,
      })),
    };
    expect(dialogueArchitectureIssues(rigid)).toEqual([
      'dialogue ignores its assigned architecture by reverting to rigid ABAB alternation',
      'unequal exchange needs two moments where the same character speaks twice',
    ]);

    const varied = {
      ...rigid,
      dialogue: rigid.dialogue.map((line, index) => ({
        ...line,
        speaker: index === 2 || index === 5 ? rigid.dialogue[index - 1]!.speaker : line.speaker,
      })),
    };
    expect(dialogueArchitectureIssues(varied)).toEqual([]);
  });

  it('fully applies corrective pacing while the delivered feed is too silent', () => {
    const brief: NonNullable<Parameters<typeof assignedPacing>[1]> = {
      schemaVersion: 1,
      generatedAt: '2026-07-30T00:00:00.000Z',
      windowMinutes: 30,
      sampleSize: 30,
      scores: {
        premiseClarity: 6,
        comedyEscalation: 5,
        dialogueCoherence: 6,
        visualMatch: 5,
        paceVariety: 4,
        originality: 5,
        shareability: 4,
      },
      increaseFormats: ['shopping'],
      increasePacing: ['frantic', 'interrupted'],
      avoidMotifs: [],
      preserveStrengths: ['clear character wants'],
      editorialDirection: 'Keep speech and visible action moving.',
      delivery: {
        isLive: true,
        concurrentViewers: 1,
        silenceRatio: 0.21,
        freezeRatio: 0.12,
        fallbackOccurrences: 0,
      },
    };

    expect(
      Array.from({ length: 40 }, (_, serial) => assignedPacing(serial, brief)).every((pacing) =>
        brief.increasePacing.includes(pacing),
      ),
    ).toBe(true);
    for (let serial = 0; serial < 70; serial += 1) {
      const frame =
        userPrompt(serial, [], [], [], brief).match(/Format-specific comedy frame: (.+)\n/u)?.[1] ??
        '';
      expect(frame).not.toMatch(
        /\b(?:customer refuses|clerk refuses|contractually|workplace benefit)\b/iu,
      );
    }
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

  it('turns internal gate failures into bounded corrective guidance', () => {
    const prompt = userPrompt(
      12,
      [],
      [],
      [
        'premise must begin with the physical setting so the renderer can stage it',
        'non-visual story mode introduces an automatic body or set transformation',
        'premise semantically repeats "untrusted previous output" (0.999)',
      ],
    );

    expect(prompt).toContain('Correct these mechanical defects');
    expect(prompt).toContain('name the assigned physical setting immediately');
    expect(prompt).toContain('permits only a social or procedural consequence');
    expect(prompt).toContain('catalogue-novel objective, mechanism and consequence');
    expect(prompt).not.toContain('untrusted previous output');
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
