# Elsewhere Cable

**Infinite television from places that don’t exist.**

Elsewhere Cable is an original, infinitely running television network received by the home server
named Endor. This repository currently contains **Milestone 0 only**: the smallest safe technical
foundation, host diagnostics, a deterministic Three.js broadcast scene, renderer/encoder benchmarks
and a two-host capability report.

Nothing here starts a public stream, installs an AI model, opens a firewall port or needs a stream key.

## Current decision

- The Apple Silicon development Mac can support an **Enhanced development profile**.
- Endor should begin with the **Minimal production profile** at 1280×720, 25 fps.
- Endor can likely progress to **Standard** after its Radeon/VA-API, renderer and upload tests pass
  directly on the NAS.
- See [the capability report](docs/endor-capability-report.md) for the evidence and constraints.

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer
- FFmpeg (required only for the encoder benchmark)
- Chrome or Chromium (required only for the automated renderer benchmark)
- Docker is detected but is not required for local Milestone 0 development

## Quick start

```bash
pnpm install
pnpm diagnose
pnpm dev
```

The renderer is bound to `127.0.0.1` and Vite will print its local URL. The internal broadcast frame is
fixed at 1280×720; programme material is presented in a 4:3 region with Elsewhere Cable telemetry in
the remaining space.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
pnpm benchmark:renderer
pnpm benchmark:encoder
pnpm report
```

The encoder benchmark processes 30 minutes of synthetic 720p25 video and 48 kHz audio by default. It
uses FFmpeg’s null muxer so it proves the complete encode without leaving a large synthetic media
file. Host-specific benchmark JSON and the renderer screenshot are written under `data/benchmarks/`
and ignored by Git.

Run a shorter smoke test while developing:

```bash
pnpm benchmark:renderer -- --seconds 5
pnpm benchmark:encoder -- --duration 30
```

Run a specific encoder:

```bash
pnpm benchmark:encoder -- --duration 1800 --encoder h264_vaapi
```

Set `ELSEWHERE_CHROME_PATH` if Chrome/Chromium is installed in a non-standard location.

## Diagnostics

`pnpm diagnose` writes valid, versioned JSON to `data/system-profile.json`. It records:

- OS, CPU/core count, RAM, graphics devices/APIs and workspace storage
- interface names without publishing IP or MAC addresses
- Node, pnpm, Docker and FFmpeg versions
- every H.264 encoder listed by FFmpeg and relevant H.264/AAC codec support
- local Ollama, llama.cpp, LM Studio and MLX command/endpoint availability
- aggregate model-file counts and sizes without model paths
- Piper, Coqui, eSpeak and macOS native TTS availability

The diagnostic is read-only. It does not install packages or models.

## Running the Endor acceptance gate

Endor is a shared TrueNAS SCALE host. Run the tools from a private development/app workspace; do not
publish the Vite port or place it behind the existing reverse proxy.

```bash
pnpm install --frozen-lockfile
pnpm diagnose
pnpm build
pnpm benchmark:renderer -- --seconds 60
pnpm benchmark:encoder -- --duration 1800
pnpm report
```

For an AMD hardware benchmark, the process must be able to access the render device (normally
`/dev/dri/renderD128`) and FFmpeg must include VA-API support. The scripts safely fall back to
`libx264` in automatic mode. A direct Endor result is required before production settings are chosen.

## Workspace

```text
apps/
  renderer/                 Three.js 720p broadcast scene
data/
  system-profile.json       Sanitised live-host diagnostic
  endor-known-profile.json  Archived/monitoring facts, clearly labelled
  benchmarks/               Generated, ignored benchmark evidence
docs/
  endor-capability-report.md
infra/scripts/
  diagnose.ts
  benchmark-renderer.ts
  benchmark-encoder.ts
  generate-report.ts
```

The workspace already reserves `packages/*` and `services/*` for later milestones without adding
empty services prematurely.

## Security and project boundaries

- All development and preview servers bind to localhost.
- No IP addresses, serial numbers, hardware UUIDs, model paths or credentials are committed.
- Stream keys belong in protected runtime configuration in later milestones.
- Generated text is never executable renderer code; later milestones will use versioned JSON schemas.
- The service will never generate or broadcast real-world news.

## Project status

Milestone 0 is the only implemented scope. Channel switching, structured programme generation,
persistent continuity, TTS packaging, infinite playout, operator controls and streaming come in later
milestones after Endor passes its direct acceptance gate.

No open-source license has been selected yet.
