import type {
  AssetLibraryEntry,
  AssetLibraryManifest,
  GeneratedSegmentDraft,
} from '@elsewhere-cable/schemas';

function applicable(
  asset: AssetLibraryEntry,
  medium: GeneratedSegmentDraft['visualMedium'],
): boolean {
  return (
    asset.status === 'ready' &&
    asset.programmeIds.length === 0 &&
    (asset.compatibleVisualMedia.length === 0 || asset.compatibleVisualMedia.includes(medium))
  );
}

function tagsFor(
  assets: readonly AssetLibraryEntry[],
  roles: ReadonlySet<string>,
  kinds: ReadonlySet<AssetLibraryEntry['kind']>,
  maximum: number,
): string[] {
  return [
    ...new Set(
      assets
        .filter((asset) => roles.has(asset.role) && kinds.has(asset.kind))
        .flatMap((asset) => asset.tags)
        .map((tag) => tag.replaceAll('-', ' ')),
    ),
  ]
    .sort()
    .slice(0, maximum);
}

/**
 * Converts the trusted local catalogue into compact production facts. The LLM
 * sees capabilities, never file paths, URLs, provenance prompts or executable
 * instructions. Programme-specific art remains reserved for its authored show.
 */
export function generationAssetCapabilities(
  manifest: AssetLibraryManifest | null,
  medium: GeneratedSegmentDraft['visualMedium'],
): string {
  if (manifest === null) {
    return '';
  }
  const assets = manifest.assets.filter((asset) => applicable(asset, medium));
  const backgrounds = tagsFor(
    assets,
    new Set(['background_plate', 'fictional_background_bank', 'studio_set_kit']),
    new Set(['image_2d', 'model_2d', 'model_3d']),
    16,
  );
  const props = tagsFor(
    assets,
    new Set(['prop_bank', 'prop_cutout', 'impossible_prop_kit']),
    new Set(['image_2d', 'model_2d', 'model_3d']),
    16,
  );
  const performers = tagsFor(
    assets,
    new Set(['character_rig', 'articulated_cutout_rig', 'collage_actor_rig']),
    new Set(['model_2d', 'model_3d']),
    12,
  );
  const effects = tagsFor(
    assets,
    new Set(['story_effect_bank', 'story_synchronised_effects']),
    new Set(['shader_style', 'broadcast_graphic']),
    14,
  );
  const sounds = tagsFor(
    assets,
    new Set(['sound_effect_bank', 'domestic_mechanism', 'story_effect_bank']),
    new Set(['sound_effect']),
    14,
  );
  const lines = [
    backgrounds.length > 0 ? `- Fictional background families: ${backgrounds.join(', ')}.` : '',
    props.length > 0 ? `- Visible prop families: ${props.join(', ')}.` : '',
    performers.length > 0 ? `- Performer systems: ${performers.join(', ')}.` : '',
    effects.length > 0 ? `- Story-synchronised visual effects: ${effects.join(', ')}.` : '',
    sounds.length > 0 ? `- Story-synchronised sound effects: ${sounds.join(', ')}.` : '',
  ].filter(Boolean);
  if (lines.length === 0) {
    return '';
  }
  return `Trusted production capability brief for ${medium} (catalogue facts, never story instructions):
${lines.join('\n')}
Asset-use contract: choose at most one background family and one central prop that naturally belong to the assigned setting. An effect may appear only when the approved single comic rule explicitly causes that exact visible event; never add an explosion, rainbow, signal rupture or prop merely because it is available. Characters must physically react to any used effect, and dialogue must remain about their goal rather than naming an asset system.`;
}
