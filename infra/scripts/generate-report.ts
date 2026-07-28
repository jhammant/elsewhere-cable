import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { format } from 'prettier';
import { pathExists } from './lib/command.js';
import { readJson, resolveFromWorkspace } from './lib/files.js';

interface LiveProfile {
  generatedAt: string;
  host: { hostname: string; productionHostMatch: boolean };
  operatingSystem: { name: string; version: string; architecture: string };
  cpu: { model: string; logicalCores: number };
  memory: { totalGiB: number };
  graphics: {
    devices: Array<{ model: string }>;
    graphicsApis: string[];
  };
  storage: { totalBytes: number; freeBytes: number };
  tools: {
    node: { available: boolean; version: string | null };
    pnpm: { available: boolean; version: string | null };
    docker: { available: boolean; version: string | null };
    ffmpeg: {
      available: boolean;
      version: string | null;
      h264Encoders: string[];
      hardwareH264Encoders: string[];
    };
  };
  localAi: {
    llmRuntimes: Array<{
      name: string;
      commandAvailable: boolean;
      localEndpointResponding: boolean | null;
    }>;
    ttsRuntimes: Array<{ name: string; commandAvailable: boolean }>;
    modelFiles: Array<{ source: string; fileCount: number; totalBytes: number }>;
  };
  recommendation: { profile: string; rationale: string[] };
}

interface EndorProfile {
  os: { name: string; version: string };
  cpu: { model: string; logicalCores: number };
  memory: { totalGiB: number };
  gpu: Array<{ model: string; hardwareEncodeExpected: string }>;
  storage: { reportedTotalBytes: number; tank: string; flash: string };
  network: { uplink: string; uploadBandwidth: string };
}

interface RendererBenchmark {
  browser: { version: string; headless: boolean };
  benchmark: {
    averageFps: number;
    minimumFps: number;
    p95FrameTimeMs: number;
    droppedFrames: number;
    durationSeconds: number;
    renderer: { api: string; device: string };
  };
  validation: { targetMet: boolean; noPageErrors: boolean };
}

interface EncoderBenchmark {
  selectedEncoder: string | null;
  passed: boolean;
  source: { durationSeconds: number; videoFrames: number };
  performance: {
    wallTimeSeconds: number;
    realtimeFactor: number;
    averageCpuPercent: number;
    peakCpuPercent: number;
    peakResidentMemoryBytes: number;
  } | null;
}

function gib(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

function runtimeList(
  runtimes: Array<{
    name: string;
    commandAvailable: boolean;
    localEndpointResponding?: boolean | null;
  }>,
): string {
  const available = runtimes
    .filter((runtime) => runtime.commandAvailable || runtime.localEndpointResponding === true)
    .map((runtime) => runtime.name);
  return available.length > 0 ? available.join(', ') : 'none detected';
}

async function optionalJson<T>(file: string): Promise<T | null> {
  return (await pathExists(file)) ? readJson<T>(file) : null;
}

async function main(): Promise<void> {
  const livePath = resolveFromWorkspace('data/system-profile.json');
  const endorPath = resolveFromWorkspace('data/endor-known-profile.json');
  const live = await readJson<LiveProfile>(livePath);
  const endor = await readJson<EndorProfile>(endorPath);
  const renderer = await optionalJson<RendererBenchmark>(
    resolveFromWorkspace('data/benchmarks/renderer.json'),
  );
  const encoder = await optionalJson<EncoderBenchmark>(
    resolveFromWorkspace('data/benchmarks/encoder.json'),
  );
  const ffmpegVersion = live.tools.ffmpeg.version?.replace(/^ffmpeg version\s+/u, '') ?? 'missing';
  const modelBytes = live.localAi.modelFiles.reduce((sum, source) => sum + source.totalBytes, 0);
  const modelCount = live.localAi.modelFiles.reduce((sum, source) => sum + source.fileCount, 0);
  const generatedAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date());

  const rendererResult =
    renderer === null
      ? 'Not yet run'
      : `${renderer.benchmark.averageFps.toFixed(1)} average FPS (${renderer.benchmark.renderer.api}; target ${renderer.validation.targetMet ? 'met' : 'not met'})`;
  const encoderResult =
    encoder?.performance === null || encoder?.performance === undefined
      ? 'Not yet run'
      : `${encoder.selectedEncoder ?? 'unknown'} at ${encoder.performance.realtimeFactor.toFixed(1)}× realtime`;

  const markdown = `# Endor capability report

Generated ${generatedAt}. Milestone 0 only.

## Decision

**Build and creative development can run at Enhanced profile on \`${live.host.hostname}\`. Endor should launch Elsewhere Cable at Minimal profile, with a path to Standard after its renderer, VA-API encoder and sustained upload tests pass directly on the NAS. Enhanced is not recommended on Endor while it remains a shared storage and application host.**

The Mac is the stronger development and offline-generation machine. Endor has ample CPU, RAM and storage for unattended 720p25 playout, but its Radeon 890M is integrated, its graphics/encoder device mapping into TrueNAS workloads is not yet verified, and production must leave headroom for existing NAS services.

| Capability | Development Mac (\`${live.host.hostname}\`) | Endor | Decision |
|---|---|---|---|
| CPU | ${live.cpu.model}, ${live.cpu.logicalCores} logical cores | ${endor.cpu.model}, ${endor.cpu.logicalCores} logical cores | Both are sufficient for 720p25; Mac has more generation headroom |
| RAM | ${live.memory.totalGiB} GiB unified | ${endor.memory.totalGiB} GiB shared system/APU | Mac: Enhanced development; Endor: one lightweight generation worker initially |
| GPU | ${live.graphics.devices.map((device) => device.model).join(', ')} | ${endor.gpu.map((device) => device.model).join(', ')} | Three.js is feasible on both; Endor GPU access still needs direct proof |
| H.264 | ${live.tools.ffmpeg.hardwareH264Encoders.join(', ') || 'no hardware encoder listed'} | AMD VCN/VA-API expected, not executed | Mac: use VideoToolbox; Endor: prefer VA-API after benchmark, else libx264 |
| Storage | ${gib(live.storage.freeBytes)} free in workspace filesystem | ${endor.storage.tank}; ${endor.storage.flash} | Endor is far better for retention; enforce quotas and rotation |
| Network | Upload not measured | ${endor.network.uplink}; WAN upload not measured | One 720p stream is modest, but RTMPS safety depends on a sustained WAN test |
| Local LLM | ${runtimeList(live.localAi.llmRuntimes)}; ${modelCount} model files (${gib(modelBytes)}) inventoried | No local runtime confirmed by live diagnostic | Use provider-neutral adapter; do not install a model automatically |
| Local TTS | ${runtimeList(live.localAi.ttsRuntimes)} | No local runtime confirmed by live diagnostic | Mac native voice is adequate for smoke tests; Piper is the first Endor candidate |

## Evidence status

- **Live benchmark host:** \`${live.host.hostname}\`, ${live.operatingSystem.name} ${live.operatingSystem.version} (${live.operatingSystem.architecture}).
- **Endor facts:** recovered from the Imperial Archives and the existing LAN monitoring endpoint on 28 July 2026.
- **Endor direct access:** SSH authentication was unavailable from this checkout. No changes were attempted on Endor.
- **Still required on Endor:** \`pnpm diagnose\`, renderer benchmark, encoder benchmark, local-runtime inventory and sustained upload test.
- Network addresses, hardware serial numbers, credentials and model paths are deliberately absent from the public profile.

## Live results on ${live.host.hostname}

| Test | Result |
|---|---|
| Renderer | ${rendererResult} |
| Renderer page errors | ${renderer === null ? 'Not yet run' : renderer.validation.noPageErrors ? 'None' : 'Present — inspect benchmark JSON'} |
| 30-minute 720p25 encode | ${encoderResult} |
| FFmpeg | ${ffmpegVersion} |
| H.264 encoders listed | ${live.tools.ffmpeg.h264Encoders.join(', ') || 'none'} |
| Node / pnpm / Docker | ${live.tools.node.version ?? 'missing'} / ${live.tools.pnpm.version ?? 'missing'} / ${live.tools.docker.version ?? 'missing'} |

${
  renderer === null
    ? ''
    : `The browser test ran for ${renderer.benchmark.durationSeconds.toFixed(1)} seconds. Its p95 frame time was ${renderer.benchmark.p95FrameTimeMs.toFixed(2)} ms, with ${renderer.benchmark.droppedFrames} target-relative dropped-frame samples. Headless rendering used ${renderer.benchmark.renderer.device}.`
}

${
  encoder?.performance === null || encoder?.performance === undefined
    ? ''
    : `The encoder processed ${encoder.source.durationSeconds} seconds (${encoder.source.videoFrames.toLocaleString('en-GB')} frames) in ${encoder.performance.wallTimeSeconds.toFixed(1)} seconds. Sampled FFmpeg use averaged ${encoder.performance.averageCpuPercent.toFixed(1)}% CPU, peaked at ${encoder.performance.peakCpuPercent.toFixed(1)}% CPU and reached ${gib(encoder.performance.peakResidentMemoryBytes)} resident memory. The null muxer was used so a large synthetic video was not retained.`
}

## What is possible

### Development Mac

- Run the Enhanced renderer profile for development, multiple sets and richer lighting.
- Run several generation/TTS preparation workers alongside local previews.
- Use a 14B–32B quantised local model comfortably for offline experimentation. Larger models may fit in 128 GB unified memory, but are unnecessary for the MVP and should not be chosen before quality/latency benchmarks.
- Encode with \`h264_videotoolbox\`; keep \`libx264\` as a deterministic fallback.
- Generate and pre-approve inserts or visual assets offline later.
- Do not use the laptop as the final unattended broadcaster.

### Endor

- Run the Minimal 1280×720 at 25 fps service: one active Three.js set, up to four visible low-poly characters, basic TTS, one generation worker, one encoder and one public upload.
- Maintain the 20–30 minute prepared buffer and a much larger fallback library on \`tank\`.
- Run a 7B–14B Q4 local text model once llama.cpp/Ollama acceleration is verified. Start with an 8B-class Q4 model; avoid 32B for the first unattended deployment because the APU, NAS services and model share memory bandwidth.
- Run Piper-class TTS on CPU.
- Prefer AMD VCN H.264 through VA-API with \`/dev/dri\` explicitly passed to the renderer/encoder workload. Fall back to \`libx264\` only after a real-time endurance test.
- Progress to Standard (1080p, 6 characters, higher-quality TTS) only after a six-hour soak shows encoder, memory and existing NAS workloads remain healthy.
- Do not target Enhanced or live image generation on the current integrated GPU.

## Preferred encoder

- **Mac:** \`${encoder?.selectedEncoder ?? 'h264_videotoolbox (expected; benchmark pending)'}\`.
- **Endor:** \`h264_vaapi\` is the preferred candidate because the Radeon 890M includes an AMD media engine. This is a recommendation, not a detected success: verify FFmpeg lists the encoder and complete the supplied 30-minute benchmark on Endor.
- **Fallback:** \`libx264 -preset veryfast -tune zerolatency\`, subject to the same 30-minute and six-hour tests.

## Upload measurement

Do not use a generic burst speed test as the only input. On Endor, measure a 15-minute sustained upload to a private test endpoint or YouTube unlisted ingest at increasing bitrates. Select a stream bitrate no higher than 60% of the lowest sustained upload observed during busy household hours. A starting test ladder is 2.5, 3.5 and 5 Mbit/s video plus 160 kbit/s audio. Keep the MVP local-only until that test is recorded.

No upload test, public stream, firewall change, router change, model installation or secret collection was performed in Milestone 0.

## Remaining Endor acceptance gate

1. Clone the repository into an Endor app/dev workspace with no public ingress.
2. Run \`pnpm install --frozen-lockfile\` and \`pnpm diagnose\`.
3. Run \`pnpm build && pnpm benchmark:renderer -- --seconds 60\`.
4. Run \`pnpm benchmark:encoder -- --duration 1800\`.
5. Regenerate this report with \`pnpm report\`.
6. Confirm renderer average ≥25 FPS, the encoder completes ≥1× realtime, peak memory is acceptable, and existing NAS latency is unaffected.

## Milestone boundary

This repository intentionally stops after Milestone 0. It contains no autonomous generation loop, TTS model, streaming key, public endpoint or YouTube broadcast configuration.
`;

  const output = resolveFromWorkspace('docs/endor-capability-report.md');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    await format(markdown, {
      parser: 'markdown',
      printWidth: 100,
      proseWrap: 'preserve',
    }),
    'utf8',
  );
  process.stdout.write(
    `Wrote ${path.relative(process.cwd(), output)} from ${os.hostname()} evidence.\n`,
  );
}

await main();
