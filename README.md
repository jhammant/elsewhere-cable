# Elsewhere Cable

**Infinite television from places that don’t exist.**

Elsewhere Cable is an original, infinitely running television network received by the home server
named Endor. The repository now contains the Milestone 0 technical foundation plus a runnable hybrid
vertical slice: Ghost batch-creates validated scripts and speech packages, while a lightweight
playout process runs the prepared queue on either Ghost or Endor.

Nothing here starts a public stream, installs an AI model, opens a firewall port or needs a stream key.

## Current decision

- The Apple Silicon development Mac can support an **Enhanced development profile**.
- Endor should run the **Minimal playout profile** at 1280×720, 25 fps without a resident large
  language model.
- Ghost can create quality segment packages at a measured **4.27× realtime** with two concurrent
  workers using a locally available 26B-A4B model.
- Endor can likely progress to **Standard** after its Radeon/VA-API, renderer and upload tests pass
  directly on the NAS.
- See [the hybrid runtime decision](docs/hybrid-runtime.md) and
  [the capability report](docs/endor-capability-report.md) for the evidence and constraints.

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
pnpm channel:start
```

Open <http://127.0.0.1:4174>. The first start creates four voiced, pre-approved demo packages if the
queue is empty, then continuously cycles them. The renderer and control API are bound to
`127.0.0.1`; no public stream is started.

Check the live queue from another terminal:

```bash
pnpm channel:status
```

The internal broadcast frame is fixed at 1280×720; programme material is presented in a 4:3 region
with Elsewhere Cable telemetry in the remaining space.

## Batch creation on Ghost

The default Ollama-compatible path uses the lightweight model already selected in `.env.example`:

```bash
pnpm generate:batch -- --count 8 --concurrency 1
```

For the measured quality lane, load the locally available sparse model in LM Studio with two
prediction slots, then run:

```bash
lms load google/gemma-4-26b-a4b \
  --context-length 8192 \
  --parallel 2 \
  --ttl 600 \
  --identifier elsewhere-cable-gemma26b-a4b-p2 \
  --yes

pnpm generate:batch -- \
  --count 12 \
  --concurrency 2 \
  --history data/segments \
  --output data/segments-quality \
  --base-url http://127.0.0.1:1234/v1 \
  --model elsewhere-cable-gemma26b-a4b-p2 \
  --tts-base-url http://127.0.0.1:8878/v1 \
  --tts-model mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16
```

The generation process validates the model response, performs a bounded repair retry, rejects basic
safety/originality violations, generates each speech line, measures its real duration with FFprobe,
converts it to 48 kHz AAC, and only then appends the package to the playout manifest.
`--history` checks every existing packaged title, premise and dialogue line without putting the old
segments into the new playout queue. The local Nomic embedding model also rejects semantically
equivalent premises at a fail-closed similarity gate, even when their wording differs.

Do not run separate batch processes against the same segment directory. Use the built-in
`--concurrency` option so manifest writes remain serialized.

Once the initial `data/segments-live` queue exists, generate another 24 quality segments and
atomically publish the enlarged queue to Endor with:

```bash
pnpm generate:live
```

To keep Ghost producing and publishing batches until stopped with `Ctrl-C`:

```bash
pnpm generate:live:loop
```

For a public stream whose original-script lane is slower than realtime, keep a rotating approved
reserve while placing each newly authored programme a few clips ahead of the live position:

```bash
ELSEWHERE_PACKAGE_PREPARED_SCRIPTS=1 \
ELSEWHERE_RECOVERY_REFILL_COUNT=12 \
ELSEWHERE_PRIORITISE_LIVE_ORIGINALS=1 \
ELSEWHERE_LIVE_PRIORITY_LOOKAHEAD=3 \
pnpm generate:live:loop
```

Recovery entries reuse audio-audited catalogue programmes under new playout IDs. They are an
availability reserve, not new material. New originals are inserted after a three-clip safety
lookahead so an atomic Endor sync cannot disturb the segment currently playing.

The sync uses hard links to the previous Endor release for unchanged packages, so publishing a
larger manifest does not duplicate every existing audio file.

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
  generation-worker/       Ghost batch generation + TTS packaging
  playout-controller/      Local queue API and static playout server
  renderer/                Hybrid Canvas 2D / Three.js 720p broadcast scene
packages/
  schemas/                  Versioned Zod segment and manifest contracts
data/
  system-profile.json       Sanitised live-host diagnostic
  endor-known-profile.json  Archived/monitoring facts, clearly labelled
  segments/                 Generated packages; ignored by Git
  benchmarks/               Generated, ignored benchmark evidence
docs/
  endor-capability-report.md
infra/scripts/
  diagnose.ts
  benchmark-renderer.ts
  benchmark-encoder.ts
  generate-report.ts
```

## Security and project boundaries

- All development and preview servers bind to localhost.
- No IP addresses, serial numbers, hardware UUIDs, model paths or credentials are committed.
- Stream keys belong in protected runtime configuration in later milestones.
- Generated text is never executable renderer code; later milestones will use versioned JSON schemas.
- Every loaded package is parsed through the versioned Zod contract before playout.
- The service will never generate or broadcast real-world news.

## Endor broadcast

Endor now has an independently restartable, localhost-only Docker playout stack. It captures the
hybrid Canvas 2D / Three.js renderer and PulseAudio mix, uses Radeon VA-API H.264, and can upload one
720p25 RTMPS stream to YouTube:

```bash
pnpm endor:sync
pnpm endor:deploy
pnpm endor:youtube:key
pnpm endor:youtube:start
```

The stream key prompt is hidden and stores the key only in a protected file on Endor. Run
`pnpm endor:youtube:stop` as the upload kill switch. See
[the YouTube runbook](docs/streaming-youtube.md) before the first unlisted test.

## Project status

The hybrid vertical slice now runs unattended on Endor with deterministic channel switching,
synchronized speech and subtitles, protected fallback behaviour, hardware H.264 encoding and a
YouTube RTMPS path. It is not yet the full MVP: persistent world continuity, a long-horizon novelty
index, the production ten-minute replenishing buffer, watchdog and operator console remain later
gates.

No open-source license has been selected yet.
