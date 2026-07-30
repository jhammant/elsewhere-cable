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

export const storyModeSchema = z.enum([
  'social_protocol',
  'service_mismatch',
  'status_transfer',
  'format_literalism',
  'object_agency',
  'product_consequence',
  'semantic_contract',
  'visual_physics',
]);

export const assetKindSchema = z.enum([
  'audio',
  'model_3d',
  'image_2d',
  'model_2d',
  'shader_style',
  'broadcast_graphic',
  'sound_effect',
]);

export const assetSourceSchema = z.enum([
  'generated_original',
  'procedural_original',
  'recorded_original',
  'licensed',
  'public_domain',
]);

const assetIdSchema = z
  .string()
  .regex(/^asset_[a-z0-9_]+$/u)
  .max(120);
const assetUriSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => !value.includes('..'), 'Asset URI must not contain parent traversal')
  .refine(
    (value) =>
      /^\/assets\/[a-z0-9_./-]+$/u.test(value) ||
      /^(?:procedure|voice):\/\/[a-z0-9_./-]+$/u.test(value),
    'Asset URI must be a local public asset, procedure, or voice reference',
  );

export const assetLibraryEntrySchema = z.object({
  id: assetIdSchema,
  kind: assetKindSchema,
  role: z
    .string()
    .regex(/^[a-z0-9_]+$/u)
    .max(80),
  version: z.number().int().min(1).max(10_000),
  status: z.enum(['ready', 'preview', 'retired']),
  uri: assetUriSchema,
  collectionId: z
    .string()
    .regex(/^[a-z0-9_-]+$/u)
    .max(100)
    .optional(),
  mimeType: z
    .string()
    .regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u)
    .max(100)
    .optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/u)
    .optional(),
  bytes: z.number().int().positive().optional(),
  dimensions: z
    .object({
      width: z.number().int().positive().max(32_768),
      height: z.number().int().positive().max(32_768),
    })
    .optional(),
  durationMs: z.number().int().positive().max(3_600_000).optional(),
  tags: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9_-]+$/u)
        .max(60),
    )
    .max(32),
  programmeIds: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9_]+$/u)
        .max(120),
    )
    .max(40)
    .default([]),
  compatibleVisualMedia: z.array(visualMediumSchema).max(22).default([]),
  provenance: z.object({
    source: assetSourceSchema,
    createdAt: z.string().datetime(),
    generator: z.string().min(1).max(120),
    rights: z.string().min(1).max(160),
    promptRef: z.string().max(240).optional(),
    containsFictionalPeople: z.boolean().default(false),
    containsRealPeople: z.literal(false),
  }),
});

export const assetLibraryManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    libraryId: z
      .string()
      .regex(/^[a-z0-9_-]+$/u)
      .max(100),
    appendOnly: z.literal(true),
    assets: z.array(assetLibraryEntrySchema).max(20_000),
  })
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    for (const [index, asset] of manifest.assets.entries()) {
      if (ids.has(asset.id)) {
        context.addIssue({
          code: 'custom',
          path: ['assets', index, 'id'],
          message: `Duplicate asset ID: ${asset.id}`,
        });
      }
      ids.add(asset.id);
      const fileBacked = asset.uri.startsWith('/assets/');
      if (fileBacked && (asset.sha256 === undefined || asset.bytes === undefined)) {
        context.addIssue({
          code: 'custom',
          path: ['assets', index],
          message: 'File-backed assets require sha256 and bytes',
        });
      }
    }
  });

export const assetGrowthRequestSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z
    .string()
    .regex(/^asset_request_[a-z0-9_]+$/u)
    .max(140),
  requestKey: z
    .string()
    .regex(/^[a-z0-9_]+$/u)
    .max(120),
  requestedAt: z.string().datetime(),
  requestedBy: z.literal('optimisation-loop'),
  status: z.literal('pending'),
  priority: z.number().int().min(1).max(100),
  kind: assetKindSchema,
  role: z
    .string()
    .regex(/^[a-z0-9_]+$/u)
    .max(80),
  objective: z.string().min(20).max(500),
  constraints: z.array(z.string().min(3).max(240)).min(3).max(16),
  programmeIds: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9_]+$/u)
        .max(120),
    )
    .max(12)
    .default([]),
  evidence: z.object({
    currentKindCount: z.number().int().min(0),
    targetKindCount: z.number().int().min(1),
    visualMatchScore: z.number().min(0).max(10).optional(),
    styleDistinctnessScore: z.number().min(0).max(10).optional(),
    visibleActionScore: z.number().min(0).max(10).optional(),
    editorialDirection: z.string().max(800).optional(),
  }),
});

export const audiencePatternSchema = z.enum([
  'visible_transformation',
  'bounded_challenge',
  'explanation',
  'reveal_chain',
  'ranked_accumulation',
  'social_reaction',
  'live_occasion',
  'process_satisfaction',
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

const optimisationDirectionSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(isOptimisationSafeText, 'Text must not contain control characters or angle brackets');

export const visualQualityObservationSchema = z.object({
  model: z
    .string()
    .min(1)
    .max(160)
    .refine(
      isOptimisationSafeText,
      'Model name must not contain control characters or angle brackets',
    ),
  sampledFrames: z.number().int().min(1).max(12),
  composition: z.number().min(0).max(10),
  legibility: z.number().min(0).max(10),
  styleDistinctness: z.number().min(0).max(10),
  visibleAction: z.number().min(0).max(10),
  overlaySafety: z.number().min(0).max(10),
  changeOfPace: z.number().min(0).max(10),
  overall: z.number().min(0).max(10),
  strongestEvidence: optimisationDirectionSchema,
  biggestProblem: optimisationDirectionSchema,
});

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
  editorialDirection: optimisationDirectionSchema,
  audienceHypothesis: z
    .object({
      pattern: audiencePatternSchema,
      evidenceCount: z.number().int().min(2).max(500),
      sampleShare: z.number().min(0).max(1),
      relativeViewVelocity: z.number().min(0).max(100),
      hypothesis: optimisationDirectionSchema,
    })
    .optional(),
  delivery: z.object({
    isLive: z.boolean().nullable(),
    concurrentViewers: z.number().int().nonnegative().nullable(),
    silenceRatio: z.number().min(0).max(1).nullable(),
    freezeRatio: z.number().min(0).max(1).nullable(),
    fallbackOccurrences: z.number().int().nonnegative(),
  }),
  visualQuality: visualQualityObservationSchema.optional(),
  windowMetrics: z
    .object({
      uniqueProgrammes: z.number().int().nonnegative(),
      programmeRepeats: z.number().int().nonnegative(),
      programmeUniquenessRatio: z.number().min(0).max(1),
      uniqueFormats: z.number().int().nonnegative(),
      uniqueVisualMedia: z.number().int().nonnegative(),
      uniqueCastArchetypes: z.number().int().nonnegative(),
      uniquePacingModes: z.number().int().nonnegative(),
    })
    .optional(),
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
    storyMode: storyModeSchema.optional(),
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
  storyMode: storyModeSchema.optional(),
  premise: z.string().min(1).max(500),
  tone: z.array(z.string().min(1).max(40)).min(1).max(6),
  dialogue: z.array(generatedDialogueSchema).min(4).max(12),
  continuityFact: z.string().min(1).max(300),
  endingBeat: z.string().min(1).max(220),
});

export const generatedSegmentProposalSchema = generatedSegmentDraftSchema.omit({
  dialogue: true,
});

export const preparedScriptSchema = z.object({
  schemaVersion: z.literal(1),
  draftId: z.string().regex(/^draft_[a-z0-9]+$/u),
  preparedAt: z.string().datetime(),
  generator: z.string().min(1).max(120),
  model: z.string().min(1).max(200),
  optimisationBriefGeneratedAt: z.string().datetime().optional(),
  draft: generatedSegmentDraftSchema,
});

export type SegmentEvent = z.infer<typeof segmentEventSchema>;
export type SegmentPackage = z.infer<typeof segmentPackageSchema>;
export type PlayoutManifest = z.infer<typeof playoutManifestSchema>;
export type PlayoutObservation = z.infer<typeof playoutObservationSchema>;
export type OptimisationBrief = z.infer<typeof optimisationBriefSchema>;
export type VisualQualityObservation = z.infer<typeof visualQualityObservationSchema>;
export type GeneratedSegmentDraft = z.infer<typeof generatedSegmentDraftSchema>;
export type GeneratedSegmentProposal = z.infer<typeof generatedSegmentProposalSchema>;
export type PreparedScript = z.infer<typeof preparedScriptSchema>;
export type AssetKind = z.infer<typeof assetKindSchema>;
export type AssetLibraryEntry = z.infer<typeof assetLibraryEntrySchema>;
export type AssetLibraryManifest = z.infer<typeof assetLibraryManifestSchema>;
export type AssetGrowthRequest = z.infer<typeof assetGrowthRequestSchema>;
