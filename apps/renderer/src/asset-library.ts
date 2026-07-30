import {
  assetLibraryManifestSchema,
  type AssetLibraryEntry,
  type AssetLibraryManifest,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';

export interface VisualAssetCollection {
  id: string;
  background: AssetLibraryEntry | null;
  characters: AssetLibraryEntry[];
}

function isCompatible(entry: AssetLibraryEntry, segment: SegmentPackage): boolean {
  return (
    entry.status === 'ready' &&
    (entry.compatibleVisualMedia.length === 0 ||
      (segment.visualMedium !== undefined &&
        entry.compatibleVisualMedia.includes(segment.visualMedium))) &&
    (entry.programmeIds.length === 0 || entry.programmeIds.includes(segment.programme.id))
  );
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function backgroundRelevance(entry: AssetLibraryEntry, segment: SegmentPackage): number {
  const haystack = [
    segment.channel.name,
    segment.programme.title,
    segment.programme.format,
    segment.programme.premise,
  ]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ');
  const genericTags = new Set([
    'background',
    'broadcast',
    'fictional',
    'original',
    'plate',
    'studio',
    'television',
  ]);
  return entry.tags.reduce((score, tag) => {
    const token = tag.toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
    return token.length >= 3 && !genericTags.has(token) && haystack.includes(token)
      ? score + 1
      : score;
  }, 0);
}

export async function loadAssetLibrary(
  source = '/assets/library/catalog.json',
): Promise<AssetLibraryManifest> {
  const response = await fetch(source, {
    cache: 'no-store',
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    throw new Error(`Asset library failed with HTTP ${response.status}`);
  }
  return assetLibraryManifestSchema.parse(await response.json());
}

export function visualAssetCollection(
  manifest: AssetLibraryManifest,
  segment: SegmentPackage,
): VisualAssetCollection | null {
  const programmeBackgrounds = manifest.assets.filter(
    (entry) =>
      entry.kind === 'image_2d' &&
      entry.role === 'background_plate' &&
      entry.collectionId !== undefined &&
      entry.programmeIds.includes(segment.programme.id) &&
      isCompatible(entry, segment),
  );
  const reusableBackgrounds = manifest.assets.filter(
    (entry) =>
      entry.kind === 'image_2d' &&
      entry.role === 'background_plate' &&
      entry.collectionId !== undefined &&
      entry.programmeIds.length === 0 &&
      isCompatible(entry, segment),
  );
  const scoredReusable = reusableBackgrounds
    .map((entry) => ({ entry, score: backgroundRelevance(entry, segment) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        stableHash(`${segment.programme.id}:${left.entry.id}`) -
          stableHash(`${segment.programme.id}:${right.entry.id}`),
    );
  const background =
    programmeBackgrounds[0] ??
    scoredReusable[0]?.entry ??
    reusableBackgrounds[stableHash(segment.programme.id) % reusableBackgrounds.length];
  if (background?.collectionId === undefined) {
    return null;
  }
  const characters = manifest.assets.filter(
    (entry) =>
      entry.kind === 'image_2d' &&
      entry.role === 'character_cutout' &&
      entry.collectionId === background.collectionId &&
      isCompatible(entry, segment),
  );
  return {
    id: background.collectionId,
    background,
    characters,
  };
}

export function matchingPropAsset(
  manifest: AssetLibraryManifest,
  segment: SegmentPackage,
): AssetLibraryEntry | null {
  const words = new Set(segment.programme.premise.toLowerCase().match(/[a-z0-9-]+/gu) ?? []);
  const genericTags = new Set(['photo', 'cutout', 'device', 'product', 'prop']);
  return (
    manifest.assets.find(
      (entry) =>
        entry.kind === 'image_2d' &&
        entry.role === 'prop_cutout' &&
        isCompatible(entry, segment) &&
        entry.tags.some((tag) => !genericTags.has(tag) && words.has(tag)),
    ) ?? null
  );
}

function characterIdentityTokens(name: string): Set<string> {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
  return new Set([normalized, ...normalized.split(/\s+/u)].filter(Boolean));
}

export function matchingCharacterAsset(
  collection: VisualAssetCollection | null,
  characterName: string,
  fallbackIndex: number,
): AssetLibraryEntry | null {
  const characters = collection?.characters ?? [];
  if (characters.length === 0) {
    return null;
  }
  const identityTokens = characterIdentityTokens(characterName);
  return (
    characters.find((entry) => entry.tags.some((tag) => identityTokens.has(tag.toLowerCase()))) ??
    characters[fallbackIndex % characters.length] ??
    null
  );
}
