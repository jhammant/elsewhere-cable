# Asset Library

The Asset Library is Elsewhere Cable's append-only pool of reusable production material.
It is deliberately broader than a media folder: the catalog records audio and voice
profiles, procedural and file-backed 3D models, raster images, rigged 2D models,
shader/style presets, broadcast graphics, and sound effects.

The canonical catalog is:

```text
apps/renderer/public/assets/library/catalog.json
```

Run its integrity and coverage audit with:

```bash
pnpm assets:audit
```

Queue the next measured production gap with:

```bash
pnpm assets:plan
```

The 30-minute optimisation loop runs both commands. Planning appends one bounded,
rights-safe request at a time under `data/asset-library/requests/`; it never blocks
playout or silently admits generated output to the production catalog. Image, audio,
model and style workers may fulfil these requests offline, but the normal audit, preview,
provenance and guarded renderer handover still apply.

The audit validates the versioned schema, local-only URIs, unique IDs, file sizes and
SHA-256 hashes. It writes the current coverage report to:

```text
data/asset-library/status.json
```

## Growth loop

1. Optimisation identifies an underrepresented look, sound, character family, prop, set
   or transition.
2. A bounded asset request is generated without names of public figures, copyrighted
   characters, brands, or unlicensed source URLs.
3. The asset is created offline on Ghost or by an explicitly configured provider. Live
   playout does not wait for it.
4. Image cutouts receive alpha validation; audio receives loudness, silence and duration
   checks; 3D models receive polygon, material and render-time checks.
5. A human-safe provenance record, rights statement, compatibility tags and immutable
   asset ID are appended to the catalog.
6. `pnpm assets:audit`, renderer tests and a local visual/audio preview must pass.
7. A controlled programme arm references the asset IDs. Its quality and audience scores
   are compared with the previous arm before wider use.
8. Assets that underperform are marked `retired`; their catalog history is retained.

## Runtime rules

- Segment JSON never contains executable asset code or remote URLs.
- The renderer resolves local assets from the validated catalog.
- Programme-bound collections keep recurring shows visually consistent.
- Reusable assets require concrete premise/tag matches so one prop does not flood every
  channel.
- Missing catalogs, files or decoders fall back to procedural rendering without blank
  video.
- Asset creation and renderer deployment are separate from the Endor uploader, so
  building the library cannot stop the public stream.

## Generation awareness

The generation worker reads the validated catalog at startup and converts it into a
bounded capability brief for the assigned visual medium. The brief contains reusable
background, prop, performer, sound and effect tags only: it omits file paths, remote
references, provenance prompts and programme-reserved artwork.

The proposal and script stages receive the same brief. Their asset-use contract permits
one story-relevant background family and one central prop; spectacular effects are
allowed only when the approved single comic rule explicitly causes that event. This
keeps the picture aligned with the dialogue while preventing the asset library from
turning every scene into unrelated decoration.

## Rights and people

Generated people must be explicitly fictional and must not intentionally resemble public
figures or recognisable performers. Real people, random scraped faces, real-news
photographs, and unlicensed media are not admitted to the catalog. Current events may
contribute abstract story shapes, but on-air people, places and claims remain fictional.
