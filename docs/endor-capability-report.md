# Endor capability report

Generated 28 July 2026 at 09:44. Milestone 0 only.

## Decision

**Build and creative development can run at Enhanced profile on `ghost`. Endor should launch Elsewhere Cable at Minimal profile, with a path to Standard after its renderer, VA-API encoder and sustained upload tests pass directly on the NAS. Enhanced is not recommended on Endor while it remains a shared storage and application host.**

The Mac is the stronger development and offline-generation machine. Endor has ample CPU, RAM and storage for unattended 720p25 playout, but its Radeon 890M is integrated, its graphics/encoder device mapping into TrueNAS workloads is not yet verified, and production must leave headroom for existing NAS services.

| Capability | Development Mac (`ghost`)                                                  | Endor                                                        | Decision                                                                         |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| CPU        | Apple M5 Max, 18 logical cores                                             | AMD Ryzen AI 9 HX PRO 370 with Radeon 890M, 24 logical cores | Both are sufficient for 720p25; Mac has more generation headroom                 |
| RAM        | 128 GiB unified                                                            | 60.45 GiB shared system/APU                                  | Mac: Enhanced development; Endor: one lightweight generation worker initially    |
| GPU        | Apple M5 Max                                                               | AMD Radeon 890M                                              | Three.js is feasible on both; Endor GPU access still needs direct proof          |
| H.264      | h264_videotoolbox                                                          | AMD VCN/VA-API expected, not executed                        | Mac: use VideoToolbox; Endor: prefer VA-API after benchmark, else libx264        |
| Storage    | 425.2 GiB free in workspace filesystem                                     | 3 x 26 TB RAIDZ1; 2 x 2 TB NVMe mirror                       | Endor is far better for retention; enforce quotas and rotation                   |
| Network    | Upload not measured                                                        | 2 x 1 GbE LACP; WAN upload not measured                      | One 720p stream is modest, but RTMPS safety depends on a sustained WAN test      |
| Local LLM  | Ollama, llama.cpp server, LM Studio; 30 model files (89.0 GiB) inventoried | No local runtime confirmed by live diagnostic                | Use provider-neutral adapter; do not install a model automatically               |
| Local TTS  | eSpeak NG, eSpeak, macOS say                                               | No local runtime confirmed by live diagnostic                | Mac native voice is adequate for smoke tests; Piper is the first Endor candidate |

## Evidence status

- **Live benchmark host:** `ghost`, macOS 26.5.1 (arm64).
- **Endor facts:** recovered from the Imperial Archives and the existing LAN monitoring endpoint on 28 July 2026.
- **Endor direct access:** SSH authentication was unavailable from this checkout. No changes were attempted on Endor.
- **Still required on Endor:** `pnpm diagnose`, renderer benchmark, encoder benchmark, local-runtime inventory and sustained upload test.
- Network addresses, hardware serial numbers, credentials and model paths are deliberately absent from the public profile.

## Live results on ghost

| Test                    | Result                                                    |
| ----------------------- | --------------------------------------------------------- |
| Renderer                | 119.9 average FPS (WebGL 2; target met)                   |
| Renderer page errors    | None                                                      |
| 30-minute 720p25 encode | h264_videotoolbox at 22.3× realtime                       |
| FFmpeg                  | 8.1 Copyright (c) 2000-2026 the FFmpeg developers         |
| H.264 encoders listed   | h264_videotoolbox, libx264, libx264rgb                    |
| Node / pnpm / Docker    | v22.14.0 / 10.33.0 / Docker version 29.4.0, build 9d7ad9f |

The browser test ran for 15.0 seconds. Its p95 frame time was 9.10 ms, with 0 target-relative dropped-frame samples. Headless rendering used ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version).

The encoder processed 1800 seconds (45,000 frames) in 80.8 seconds. Sampled FFmpeg use averaged 42.6% CPU, peaked at 59.9% CPU and reached 0.4 GiB resident memory. The null muxer was used so a large synthetic video was not retained.

## What is possible

### Development Mac

- Run the Enhanced renderer profile for development, multiple sets and richer lighting.
- Run several generation/TTS preparation workers alongside local previews.
- Use a 14B–32B quantised local model comfortably for offline experimentation. Larger models may fit in 128 GB unified memory, but are unnecessary for the MVP and should not be chosen before quality/latency benchmarks.
- Encode with `h264_videotoolbox`; keep `libx264` as a deterministic fallback.
- Generate and pre-approve inserts or visual assets offline later.
- Do not use the laptop as the final unattended broadcaster.

### Endor

- Run the Minimal 1280×720 at 25 fps service: one active Three.js set, up to four visible low-poly characters, basic TTS, one generation worker, one encoder and one public upload.
- Maintain the 20–30 minute prepared buffer and a much larger fallback library on `tank`.
- Run a 7B–14B Q4 local text model once llama.cpp/Ollama acceleration is verified. Start with an 8B-class Q4 model; avoid 32B for the first unattended deployment because the APU, NAS services and model share memory bandwidth.
- Run Piper-class TTS on CPU.
- Prefer AMD VCN H.264 through VA-API with `/dev/dri` explicitly passed to the renderer/encoder workload. Fall back to `libx264` only after a real-time endurance test.
- Progress to Standard (1080p, 6 characters, higher-quality TTS) only after a six-hour soak shows encoder, memory and existing NAS workloads remain healthy.
- Do not target Enhanced or live image generation on the current integrated GPU.

## Preferred encoder

- **Mac:** `h264_videotoolbox`.
- **Endor:** `h264_vaapi` is the preferred candidate because the Radeon 890M includes an AMD media engine. This is a recommendation, not a detected success: verify FFmpeg lists the encoder and complete the supplied 30-minute benchmark on Endor.
- **Fallback:** `libx264 -preset veryfast -tune zerolatency`, subject to the same 30-minute and six-hour tests.

## Upload measurement

Do not use a generic burst speed test as the only input. On Endor, measure a 15-minute sustained upload to a private test endpoint or YouTube unlisted ingest at increasing bitrates. Select a stream bitrate no higher than 60% of the lowest sustained upload observed during busy household hours. A starting test ladder is 2.5, 3.5 and 5 Mbit/s video plus 160 kbit/s audio. Keep the MVP local-only until that test is recorded.

No upload test, public stream, firewall change, router change, model installation or secret collection was performed in Milestone 0.

## Remaining Endor acceptance gate

1. Clone the repository into an Endor app/dev workspace with no public ingress.
2. Run `pnpm install --frozen-lockfile` and `pnpm diagnose`.
3. Run `pnpm build && pnpm benchmark:renderer -- --seconds 60`.
4. Run `pnpm benchmark:encoder -- --duration 1800`.
5. Regenerate this report with `pnpm report`.
6. Confirm renderer average ≥25 FPS, the encoder completes ≥1× realtime, peak memory is acceptable, and existing NAS latency is unaffected.

## Milestone boundary

This repository intentionally stops after Milestone 0. It contains no autonomous generation loop, TTS model, streaming key, public endpoint or YouTube broadcast configuration.
