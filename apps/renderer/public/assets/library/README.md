# Elsewhere Cable Asset Library

This directory is the append-only, production-facing asset library for Elsewhere Cable.
Programmes select assets through `catalog.json`; they do not execute generated code or
follow generated URLs. File-backed assets are local, hashed, rights-labelled, and safe to
omit at runtime because every renderer retains a procedural fallback.

The catalog covers audio and voice profiles, procedural and file-backed 3D models, raster
images, rigged 2D models, shader/style presets, broadcast graphics, and sound effects.
Retired assets remain catalogued with `status: "retired"` so old segment packages can
still be explained and reproduced.

## photo-freezer-v1

All people are entirely fictional and do not intentionally resemble public figures.
Images were created with the built-in OpenAI image-generation tool on 30 July 2026.
Character backgrounds were generated as flat green chroma and removed locally with the
ImageGen skill's soft-matte/despill helper.

Background prompt:

> An empty low-budget municipal television interview set built inside a supermarket
> freezer aisle; folding desk, mismatched chairs, frosted freezer doors and blank notice
> boards; wide 16:9 documentary production photograph with open foreground; no brands,
> readable text, people or watermark.

Mara Vale prompt:

> A full-body studio photograph of a completely fictional middle-aged municipal TV
> presenter with short silver-black hair, mustard cardigan, burgundy blouse, practical
> trousers and calm faintly baffled expression; one front-facing person on uniform green
> chroma; no public-figure resemblance, shadow, text, logo or watermark.

Ilo Penn prompt:

> A full-body studio photograph of a completely fictional younger civic archivist with
> tightly curled dark hair, round spectacles, cobalt boiler suit, cream collar and orange
> socks; politely alarmed expression; one front-facing person on uniform green chroma; no
> public-figure resemblance, shadow, text, logo or watermark.

## weather-plastic-v1

Background prompt:

> An empty absurd weather studio built from glossy toy-like 3D forms inside a transparent
> plastic filing cabinet; hanging clouds with tiny doors and a curved forecast desk; wide
> 16:9 stylized 3D render with cel-shaded edges, cyan and apricot light, open actor
> positions; no text, brands, recognisable characters, people or watermark.

## impossible-products-v1

Anticipatory doorbell prompt:

> A complete invented domestic appliance: chunky cream wall unit, one large red button,
> mismatched brass bells, mechanical calendar wheel and a coiled cord ending in no plug;
> late-1980s catalogue product photograph on uniform green chroma; no text, brands,
> people, shadow or watermark.

## Growth rules

- Add new IDs; never silently replace an existing ID.
- Increment `version` when an asset family changes incompatibly.
- Mark disused assets `retired` instead of deleting catalog history.
- Record source, rights, generator, prompt reference, hash and dimensions.
- Never catalogue scraped faces, unlicensed media, public-figure likenesses or generated
  URLs.
- Keep live playback independent from asset generation and use procedural fallbacks for
  missing or corrupt files.
