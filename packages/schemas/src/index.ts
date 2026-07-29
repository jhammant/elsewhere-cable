import { z } from 'zod';

export const characterActionSchema = z.enum([
  'IDLE',
  'ENTER',
  'EXIT',
  'LOOK_AT',
  'POINT_AT',
  'REACTION_NEUTRAL',
  'REACTION_CONFUSED',
  'REACTION_SHOCKED',
  'REACTION_ANGRY',
  'PAUSE',
  'FREEZE',
]);

export const cameraNameSchema = z.enum(['CAMERA_WIDE', 'CAMERA_HOST', 'CAMERA_GUEST']);

export const transitionSchema = z.enum([
  'HARD_CUT',
  'STATIC_BURST',
  'FADE_TO_IDENT',
  'SIGNAL_LOSS',
]);

export const visualMediumSchema = z.enum([
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
]);

export const castArchetypeSchema = z.enum([
  'humanoid',
  'geometric_aliens',
  'talking_objects',
  'celestial',
  'paper_puppets',
  'mixed',
]);

export const pacingSchema = z.enum([
  'frantic',
  'staccato',
  'conversational',
  'slow_burn',
  'interrupted',
  'near_silent',
]);

function isOptimisationSafeText(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x20 || codePoint === 0x7f || character === '<' || character === '>') {
      return false;
    }
  }
  return true;
}

const optimisationTextSchema = z
  .string()
  .min(1)
  .max(120)
  .refine(isOptimisationSafeText, 'Text must not contain control characters or angle brackets');

export const optimisationBriefSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  windowMinutes: z.number().int().min(5).max(240),
  sampleSize: z.number().int().min(0).max(500),
  scores: z.object({
    premiseClarity: z.number().min(0).max(10),
    comedyEscalation: z.number().min(0).max(10),
    dialogueCoherence: z.number().min(0).max(10),
    visualMatch: z.number().min(0).max(10),
    paceVariety: z.number().min(0).max(10),
    originality: z.number().min(0).max(10),
    shareability: z.number().min(0).max(10),
  }),
  increaseFormats: z
    .array(z.enum(['advert', 'public_access', 'news', 'shopping', 'sitcom', 'emergency', 'ident']))
    .max(3),
  increasePacing: z.array(pacingSchema).max(3),
  avoidMotifs: z.array(optimisationTextSchema).max(12),
  preserveStrengths: z.array(optimisationTextSchema).max(8),
  editorialDirection: optimisationTextSchema.max(500),
  delivery: z.object({
    isLive: z.boolean().nullable(),
    concurrentViewers: z.number().int().nonnegative().nullable(),
    silenceRatio: z.number().min(0).max(1).nullable(),
    freezeRatio: z.number().min(0).max(1).nullable(),
    fallbackOccurrences: z.number().int().nonnegative(),
  }),
});

const timedEventSchema = z.object({
  atMs: z.number().int().min(0),
});

export const segmentEventSchema = z.discriminatedUnion('type', [
  timedEventSchema.extend({
    type: z.literal('camera.cut'),
    camera: cameraNameSchema,
  }),
  timedEventSchema.extend({
    type: z.literal('graphic.show'),
    graphic: z.enum(['LOWER_THIRD', 'WARNING', 'TITLE_CARD']),
    text: z.string().min(1).max(180),
  }),
  timedEventSchema.extend({
    type: z.literal('speech.play'),
    speechId: z.string().min(1),
    characterId: z.string().min(1),
    characterName: z.string().min(1).max(80),
    voiceId: z.string().min(1).max(80),
    subtitle: z.string().min(1).max(300),
    audioFile: z.string().min(1),
    durationMs: z.number().int().positive(),
  }),
  timedEventSchema.extend({
    type: z.literal('character.action'),
    characterId: z.string().min(1),
    action: characterActionSchema,
  }),
  timedEventSchema.extend({
    type: z.literal('audio.static'),
    durationMs: z.number().int().positive().max(5_000),
  }),
  timedEventSchema.extend({
    type: z.literal('transition.play'),
    transition: transitionSchema,
  }),
]);

export const segmentPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    segmentId: z.string().regex(/^seg_[a-z0-9_]+$/u),
    channel: z.object({
      id: z.string().min(1),
      number: z.number().int().min(-999).max(9_999_999_999),
      name: z.string().min(1).max(100),
      realityId: z.string().min(1).max(60),
    }),
    programme: z.object({
      id: z.string().min(1),
      title: z.string().min(1).max(120),
      format: z.enum([
        'advert',
        'public_access',
        'news',
        'shopping',
        'sitcom',
        'emergency',
        'ident',
      ]),
      premise: z.string().min(1).max(500),
    }),
    durationMs: z.number().int().min(5_000).max(300_000),
    visualStyle: z.string().min(1).max(80),
    visualMedium: visualMediumSchema.optional(),
    castArchetype: castArchetypeSchema.optional(),
    pacing: pacingSchema.optional(),
    tone: z.array(z.string().min(1).max(40)).min(1).max(6),
    events: z.array(segmentEventSchema).min(1),
    continuityUpdates: z.array(
      z.object({
        type: z.literal('fact.proposed'),
        subjectId: z.string().min(1),
        value: z.string().min(1).max(300),
      }),
    ),
    suggestedExit: z.object({
      earliestMs: z.number().int().min(0),
      preferredMs: z.number().int().min(0),
      transition: transitionSchema,
    }),
    production: z.object({
      generatedAt: z.string().datetime(),
      generator: z.string().min(1),
      model: z.string().min(1),
      safetyStatus: z.literal('approved-for-local-preview'),
      audioPrepared: z.boolean(),
    }),
  })
  .superRefine((segment, context) => {
    for (const event of segment.events) {
      if (event.atMs > segment.durationMs) {
        context.addIssue({
          code: 'custom',
          path: ['events'],
          message: `Event at ${event.atMs}ms exceeds segment duration`,
        });
      }
    }
    if (segment.suggestedExit.preferredMs > segment.durationMs) {
      context.addIssue({
        code: 'custom',
        path: ['suggestedExit', 'preferredMs'],
        message: 'Preferred exit exceeds segment duration',
      });
    }
  });

export const manifestEntrySchema = z.object({
  segmentId: z.string(),
  packagePath: z.string().min(1),
  durationMs: z.number().int().positive(),
  channelNumber: z.number().int(),
  channelName: z.string().min(1),
  programmeTitle: z.string().min(1),
});

export const playoutManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  totalDurationMs: z.number().int().nonnegative(),
  segments: z.array(manifestEntrySchema),
});

const segmentObservationFields = {
  schemaVersion: z.literal(1),
  occurrenceId: z.string().uuid(),
  observedAt: z.string().datetime(),
  segmentId: z.string().regex(/^seg_[a-z0-9_]+$/u),
  channelNumber: z.number().int().min(-999).max(9_999_999_999),
  channelName: z.string().min(1).max(100),
  programmeId: z.string().min(1).max(120),
  programmeTitle: z.string().min(1).max(120),
  format: z.enum(['advert', 'public_access', 'news', 'shopping', 'sitcom', 'emergency', 'ident']),
  visualMedium: visualMediumSchema,
  pacing: pacingSchema,
  durationMs: z.number().int().min(5_000).max(300_000),
};

export const playoutObservationSchema = z.discriminatedUnion('event', [
  z.object({
    ...segmentObservationFields,
    event: z.literal('segment.started'),
  }),
  z.object({
    ...segmentObservationFields,
    event: z.literal('segment.completed'),
  }),
  z.object({
    schemaVersion: z.literal(1),
    occurrenceId: z.string().uuid(),
    observedAt: z.string().datetime(),
    event: z.literal('segment.failed'),
    segmentId: z.string().regex(/^seg_[a-z0-9_]+$/u),
    reason: z.string().min(1).max(200),
  }),
  z.object({
    schemaVersion: z.literal(1),
    occurrenceId: z.string().uuid(),
    observedAt: z.string().datetime(),
    event: z.literal('fallback.started'),
    reason: z.string().min(1).max(200),
  }),
]);

export const generatedDialogueSchema = z.object({
  speaker: z.string().min(1).max(60),
  text: z.string().min(1).max(280),
  action: characterActionSchema.default('IDLE'),
});

export const generatedSegmentDraftSchema = z.object({
  channelNumber: z.number().int().min(1).max(9_999_999_999),
  channelName: z.string().min(1).max(100),
  programmeTitle: z.string().min(1).max(120),
  format: z.enum(['advert', 'public_access', 'news', 'shopping', 'sitcom', 'emergency', 'ident']),
  realityId: z.string().min(1).max(60),
  visualStyle: z.string().min(1).max(80),
  visualMedium: visualMediumSchema,
  castArchetype: castArchetypeSchema,
  pacing: pacingSchema.optional(),
  premise: z.string().min(1).max(500),
  tone: z.array(z.string().min(1).max(40)).min(1).max(6),
  dialogue: z.array(generatedDialogueSchema).min(4).max(12),
  continuityFact: z.string().min(1).max(300),
  endingBeat: z.string().min(1).max(220),
});

export const generatedSegmentProposalSchema = generatedSegmentDraftSchema.omit({
  dialogue: true,
});

export type SegmentEvent = z.infer<typeof segmentEventSchema>;
export type SegmentPackage = z.infer<typeof segmentPackageSchema>;
export type PlayoutManifest = z.infer<typeof playoutManifestSchema>;
export type PlayoutObservation = z.infer<typeof playoutObservationSchema>;
export type OptimisationBrief = z.infer<typeof optimisationBriefSchema>;
export type GeneratedSegmentDraft = z.infer<typeof generatedSegmentDraftSchema>;
export type GeneratedSegmentProposal = z.infer<typeof generatedSegmentProposalSchema>;
