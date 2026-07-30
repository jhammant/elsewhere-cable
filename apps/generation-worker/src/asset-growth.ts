import {
  assetGrowthRequestSchema,
  type AssetGrowthRequest,
  type AssetKind,
  type AssetLibraryManifest,
  type OptimisationBrief,
} from '@elsewhere-cable/schemas';

interface AssetFrontier {
  kind: AssetKind;
  targetCount: number;
  roles: readonly string[];
}

const frontiers: readonly AssetFrontier[] = [
  {
    kind: 'sound_effect',
    targetCount: 8,
    roles: ['domestic_mechanism', 'studio_reaction', 'signal_transition'],
  },
  {
    kind: 'broadcast_graphic',
    targetCount: 6,
    roles: ['title_sequence_package', 'news_graphics', 'shopping_graphics'],
  },
  {
    kind: 'audio',
    targetCount: 6,
    roles: ['music_bed', 'transition_sting', 'atmospheric_loop'],
  },
  {
    kind: 'shader_style',
    targetCount: 8,
    roles: ['render_style', 'signal_style', 'material_pack'],
  },
  {
    kind: 'model_2d',
    targetCount: 6,
    roles: ['articulated_cutout_rig', 'mouth_swap_family', 'collage_actor_rig'],
  },
  {
    kind: 'model_3d',
    targetCount: 8,
    roles: ['modular_character_family', 'impossible_prop_kit', 'studio_set_kit'],
  },
  {
    kind: 'image_2d',
    targetCount: 18,
    roles: ['background_plate', 'character_cutout', 'prop_cutout', 'graphic_insert'],
  },
];

const commonConstraints = [
  'Create wholly original material for Elsewhere Cable.',
  'Do not imitate named programmes, characters, brands, performers, artists, or public figures.',
  'Do not use scraped faces, unlicensed source media, remote runtime URLs, or executable generated code.',
  'Include local provenance and rights metadata and retain a procedural fallback.',
];

const kindConstraints: Record<AssetKind, readonly string[]> = {
  audio: [
    'Keep music instrumental and original, with clean loop or sting boundaries.',
    'Normalise loudness and verify duration, silence, clipping, and codec compatibility.',
  ],
  sound_effect: [
    'Make the sound narratively specific and recognisable without using a copyrighted recording.',
    'Provide dry and broadcast-processed variants where practical.',
  ],
  model_3d: [
    'Keep polygon, material, texture, rig, and render costs within the Endor Minimal profile.',
    'Validate a 720p25 turntable and a fallback material.',
  ],
  image_2d: [
    'Reserve broadcast-safe negative space and supply alpha only when the role requires it.',
    'Validate dimensions, matte edges, legibility, and 720p crop behaviour.',
  ],
  model_2d: [
    'Define deterministic pose, mouth, anchor, and safe-plane metadata.',
    'Keep animation executable only through the supported renderer protocol.',
  ],
  shader_style: [
    'Keep subtitles and channel graphics readable and provide a low-cost fallback.',
    'Benchmark at 720p25 on the Endor Minimal profile.',
  ],
  broadcast_graphic: [
    'Respect title, subtitle, channel-number, and overscan safe areas.',
    'Provide multiple information densities without covering faces or story props.',
  ],
};

function currentCount(manifest: AssetLibraryManifest, kind: AssetKind): number {
  return manifest.assets.filter((asset) => asset.kind === kind && asset.status !== 'retired')
    .length;
}

function roleObjective(kind: AssetKind, role: string): string {
  const readableRole = role.replaceAll('_', ' ');
  const descriptions: Record<AssetKind, string> = {
    audio: 'an original musical or atmospheric audio element',
    sound_effect: 'an original story-synchronised sound-effect family',
    model_3d: 'a reusable lightweight Three.js production asset',
    image_2d: 'a reusable fictional raster production asset',
    model_2d: 'a deterministic rigged 2D performance system',
    shader_style: 'a visibly distinct renderer style with a safe fallback',
    broadcast_graphic: 'an original broadcast graphics package',
  };
  return `Produce ${descriptions[kind]} for the ${readableRole} frontier, designed to create a meaningful change of pace rather than surface decoration.`;
}

function qualityBoost(kind: AssetKind, brief: OptimisationBrief | null): number {
  if (brief === null) {
    return 0;
  }
  const visual = brief.visualQuality;
  const visibleActionGap = Math.max(0, 8 - (visual?.visibleAction ?? 8)) / 8;
  const overlayGap = Math.max(0, 8 - (visual?.overlaySafety ?? 8)) / 8;
  const styleGap = Math.max(0, 8 - (visual?.styleDistinctness ?? 8)) / 8;
  const visualMatchGap = Math.max(0, 8 - brief.scores.visualMatch) / 8;
  switch (kind) {
    case 'model_2d':
      return visibleActionGap * 0.34;
    case 'model_3d':
      return visibleActionGap * 0.24;
    case 'broadcast_graphic':
      return overlayGap * 0.28;
    case 'shader_style':
      return styleGap * 0.24;
    case 'image_2d':
      return visualMatchGap * 0.18;
    case 'audio':
      return (brief.delivery.silenceRatio ?? 0) > 0.08 ? 0.16 : 0;
    case 'sound_effect':
      return 0;
  }
}

export function nextAssetGrowthRequest(
  manifest: AssetLibraryManifest,
  existingRequestKeys: ReadonlySet<string>,
  brief: OptimisationBrief | null,
  requestedAt = new Date().toISOString(),
): AssetGrowthRequest | null {
  const candidates = frontiers
    .flatMap((frontier, frontierIndex) => {
      const count = currentCount(manifest, frontier.kind);
      return frontier.roles.map((role, roleIndex) => ({
        ...frontier,
        count,
        role,
        roleIndex,
        frontierIndex,
        key: `${frontier.kind}_${role}_v1`,
        deficit: Math.max(0, frontier.targetCount - count) / frontier.targetCount,
        qualityBoost: qualityBoost(frontier.kind, brief),
      }));
    })
    .filter((candidate) => !existingRequestKeys.has(candidate.key))
    .sort(
      (left, right) =>
        right.deficit + right.qualityBoost - (left.deficit + left.qualityBoost) ||
        left.count - right.count ||
        left.roleIndex - right.roleIndex ||
        left.frontierIndex - right.frontierIndex ||
        left.key.localeCompare(right.key),
    );
  const selected = candidates[0];
  if (selected === undefined) {
    return null;
  }
  const timestampToken = requestedAt.replace(/[^0-9]/gu, '').slice(0, 14);
  return assetGrowthRequestSchema.parse({
    schemaVersion: 1,
    requestId: `asset_request_${timestampToken}_${selected.kind}_${selected.role}`,
    requestKey: selected.key,
    requestedAt,
    requestedBy: 'optimisation-loop',
    status: 'pending',
    priority: Math.round(55 + Math.min(1, selected.deficit + selected.qualityBoost) * 40),
    kind: selected.kind,
    role: selected.role,
    objective: roleObjective(selected.kind, selected.role),
    constraints: [...commonConstraints, ...kindConstraints[selected.kind]],
    programmeIds: [],
    evidence: {
      currentKindCount: selected.count,
      targetKindCount: selected.targetCount,
      ...(brief === null
        ? {}
        : {
            visualMatchScore: brief.scores.visualMatch,
            styleDistinctnessScore: brief.visualQuality?.styleDistinctness,
            visibleActionScore: brief.visualQuality?.visibleAction,
            editorialDirection: brief.editorialDirection.slice(0, 800),
          }),
    },
  });
}
