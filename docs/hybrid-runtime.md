# Ghost batch production and Endor playout

## Decision

Use **Ghost as the production studio** and **Endor as the broadcaster**.

Ghost creates deterministic segment directories containing validated JSON, actual-duration AAC audio
and proposed continuity updates. Endor consumes those packages without needing the production model
in memory. This preserves Endor's RAM for its existing NAS and application workloads and lets the
channel continue when Ghost is asleep.

## Measured performance

Measurements were taken on 28 July 2026.

| Stage                        | Configuration                               |                                Result |
| ---------------------------- | ------------------------------------------- | ------------------------------------: |
| Quality batch, one worker    | Gemma 4 26B-A4B, 4-bit, 8K context          |                        2.83× realtime |
| Quality batch, two workers   | Same loaded model, two parallel predictions |                    **4.27× realtime** |
| Quality batch RAM            | LM Studio reported loaded size              |                              17.99 GB |
| Fast batch                   | Llama 3.2 3B, 8K context                    | 3.44× realtime, lower writing quality |
| Hand-authored fallback + TTS | Four segments / 89.7 seconds                |                       18.05× realtime |
| Local TTS only               | macOS voice, 36.1 seconds audio             |                    about 45× realtime |
| Live Three.js playout        | WebGL 2, 1280×720                           |                    119.98 average FPS |
| Browser RAM                  | 55-second channel-switch soak               |                           999 MB peak |
| Controller RAM               | Fastify playout controller                  |                                101 MB |
| Encoder RAM                  | 30-minute VideoToolbox benchmark            |                           447 MB peak |
| H.264 encoding               | VideoToolbox, 720p25                        |                        22.3× realtime |

At 4.27× realtime, one hour of quality programming takes approximately **14 minutes** to prepare.
Four hours takes about 56 minutes. The current benchmark uses one model loaded once and two
concurrent segment requests; model memory is shared.

The dense 27B 4-bit model was tested as well. It produced good writing but only 1.04× realtime for a
finished package, so the sparse 26B-A4B model is the preferred quality/speed balance.

## RAM budget

### Endor: playout only

| Process                            |   Measured or budgeted RAM |
| ---------------------------------- | -------------------------: |
| Chromium / Three.js                |      1.0 GiB measured peak |
| Playout controller and queue       |           0.1 GiB measured |
| FFmpeg hardware encoder            | 0.45 GiB measured on Ghost |
| Audio, SQLite and operating margin |         0.5–1.5 GiB budget |
| **Recommended reservation**        |                **2–3 GiB** |

Endor's monitoring endpoint reported about **18.9 GiB available RAM** during this work. A 2–3 GiB
playout reservation is comfortable. The renderer and VA-API encoder still need direct Endor tests.

### Endor: emergency generation

The 3B Ollama model used 2.9 GB at an 8K context. It can serve as a buffer-critical emergency
generator, bringing the safe temporary Elsewhere Cable budget to roughly 6 GiB. Its writing is not
good enough to be the normal programme source. Do not keep an 8B–27B model resident on Endor while it
has only about 18.9 GiB available.

### Ghost: batch creation

Reserve **20–24 GiB** for the preferred quality lane:

- 17.99 GB loaded model reported by LM Studio.
- Shared KV/runtime memory for two prediction slots.
- Transient local TTS, FFmpeg audio conversion and the generation process.

Ghost has 128 GB unified memory, so this fits even with the renderer and encoder running. Large
foreground applications can still create memory pressure; batch work should pause rather than swap
heavily.

## Production design contract

Ghost selects bounded production fields for each new segment:

- `visualMedium`: `cel_shaded`, `paper_cutout`, `pixel_broadcast`, `archive_film`,
  `neon_wireframe`, `public_access_vhs`, `signal_corruption`, `stop_motion`, `collage_zine`,
  `ink_monochrome`, `miniature_diorama`, `corporate_vector`, `claymation`, `shadow_theatre`,
  `hand_drawn` or `thermal_camera`.
- `castArchetype`: `humanoid`, `geometric_aliens`, `talking_objects`, `celestial`,
  `paper_puppets` or `mixed`.
- `pacing`: `frantic`, `staccato`, `conversational`, `slow_burn`, `interrupted` or
  `near_silent`.

The hybrid renderer routes paper cutout, collage, monochrome ink, corporate vector and hand-drawn
programmes to a native Canvas 2D scene. The other media use Three.js. Both implementations consume
the same validated camera, dialogue, action and prop events, so a channel can change dimensionality
without changing the playout protocol. Legacy packages without these fields receive a deterministic
design from their programme and channel metadata. This keeps visual variety under editorial control
without allowing generated code or arbitrary renderer instructions.

The 3D cast pool combines six body models, six head models, stable proportions, human and non-human
palettes, one/two/three-eye layouts, hair, glasses, hats, antennae and optional limbs. The 2D cast
pool creates programme-stable flat silhouettes, faces and palettes. Only the active renderer, set
and cast are visible, so this variety does not materially change Endor's RAM budget.

## Ghost neural voice lane

Ghost can run the local Qwen3-TTS VoiceDesign service for programme-stable, described voices:

```bash
pnpm tts:qwen:setup
pnpm tts:qwen:start
pnpm seed:ghost-quality
```

The measured 1.7B BF16 service used about 5.6 GiB RAM and generated a four-line audition at about
2.0× realtime. Audio is prepared before playout and converted to 48 kHz AAC, so the heavier voice
model does not add to Endor's live playout RAM requirement.

## Package flow

```text
Ghost
  model -> validated draft -> local TTS -> FFprobe timing -> AAC + segment.json
        -> data/segments/manifest.json

private transfer
        -> Endor segment directory

Endor
  playout controller -> Zod validation -> Canvas 2D / Three.js -> FFmpeg -> later RTMPS
```

The segment directory is intentionally self-contained. Endor does not need the original model,
prompt, macOS voice runtime or source AI service.

## Transfer to Endor

SSH access was not available during implementation, so no deployment was attempted. Once access is
configured, transfer prepared files over the private LAN or Tailscale without exposing the control
API:

```bash
rsync -av data/segments/ endor:/private/elsewhere-cable/segments/
```

Set `ELSEWHERE_SEGMENTS_DIR` on Endor to that directory. Do not use a deleting sync until retention,
currently-playing package protection and rollback rules exist.

## Current boundary

This vertical slice proves batch production and continuous local package playout. It does not yet
capture the browser into FFmpeg, supervise processes, stream publicly, maintain ten minutes of
generated buffer automatically or implement the persistent world database.
