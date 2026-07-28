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
      number: z.number().int().min(-999).max(9_999),
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

export const generatedDialogueSchema = z.object({
  speaker: z.string().min(1).max(60),
  text: z.string().min(1).max(280),
  action: characterActionSchema.default('IDLE'),
});

export const generatedSegmentDraftSchema = z.object({
  channelNumber: z.number().int().min(1).max(999),
  channelName: z.string().min(1).max(100),
  programmeTitle: z.string().min(1).max(120),
  format: z.enum(['advert', 'public_access', 'news', 'shopping', 'sitcom', 'emergency', 'ident']),
  realityId: z.string().min(1).max(60),
  visualStyle: z.string().min(1).max(80),
  premise: z.string().min(1).max(500),
  tone: z.array(z.string().min(1).max(40)).min(1).max(6),
  dialogue: z.array(generatedDialogueSchema).min(4).max(12),
  continuityFact: z.string().min(1).max(300),
  endingBeat: z.string().min(1).max(220),
});

export type SegmentEvent = z.infer<typeof segmentEventSchema>;
export type SegmentPackage = z.infer<typeof segmentPackageSchema>;
export type PlayoutManifest = z.infer<typeof playoutManifestSchema>;
export type GeneratedSegmentDraft = z.infer<typeof generatedSegmentDraftSchema>;
