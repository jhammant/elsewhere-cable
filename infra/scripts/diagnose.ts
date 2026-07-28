import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { readArg } from './lib/args.js';
import { commandExists, firstLine, pathExists, run } from './lib/command.js';
import { resolveFromWorkspace, writeJson } from './lib/files.js';

interface GpuInfo {
  model: string;
  vendor: string | null;
  memoryBytes: number | null;
  details: string[];
}

interface ModelInventory {
  source: string;
  present: boolean;
  fileCount: number;
  totalBytes: number;
  formats: string[];
}

interface RuntimeProbe {
  name: string;
  commandAvailable: boolean;
  version: string | null;
  localEndpointResponding: boolean | null;
  notes: string[];
}

interface CodecSummary {
  count: number;
  h264: {
    decode: boolean;
    encode: boolean;
    description: string | null;
  };
  aac: {
    decode: boolean;
    encode: boolean;
    description: string | null;
  };
}

const bytesPerKibibyte = 1024;
const modelExtensions = new Set([
  '.bin',
  '.gguf',
  '.mlmodel',
  '.onnx',
  '.pt',
  '.pth',
  '.safetensors',
]);

async function detectOperatingSystem(): Promise<{
  name: string;
  version: string;
  kernel: string;
  architecture: string;
}> {
  if (process.platform === 'darwin') {
    const productName = await run('sw_vers', ['-productName']);
    const productVersion = await run('sw_vers', ['-productVersion']);
    return {
      name: productName.stdout || 'macOS',
      version: productVersion.stdout || os.release(),
      kernel: `${os.type()} ${os.release()}`,
      architecture: os.arch(),
    };
  }

  if (process.platform === 'linux') {
    const release = await run('sh', [
      '-c',
      '. /etc/os-release 2>/dev/null; printf "%s\\n%s" "${PRETTY_NAME:-Linux}" "${VERSION_ID:-unknown}"',
    ]);
    const [name = 'Linux', version = os.release()] = release.stdout.split(/\r?\n/u);
    return {
      name,
      version,
      kernel: `${os.type()} ${os.release()}`,
      architecture: os.arch(),
    };
  }

  return {
    name: os.type(),
    version: os.release(),
    kernel: `${os.type()} ${os.release()}`,
    architecture: os.arch(),
  };
}

async function detectCpu(): Promise<{
  model: string;
  logicalCores: number;
  physicalCores: number | null;
  architecture: string;
}> {
  let model = os.cpus()[0]?.model.trim() || 'Unknown';
  let physicalCores: number | null = null;

  if (process.platform === 'darwin') {
    const hardware = await run('system_profiler', ['SPHardwareDataType']);
    const chipMatch = hardware.stdout.match(/^\s*Chip:\s*(.+)$/mu);
    const modelMatch = hardware.stdout.match(/^\s*Processor Name:\s*(.+)$/mu);
    model = chipMatch?.[1]?.trim() ?? modelMatch?.[1]?.trim() ?? model;

    const physical = await run('sysctl', ['-n', 'hw.physicalcpu']);
    const parsed = Number.parseInt(physical.stdout, 10);
    physicalCores = Number.isFinite(parsed) ? parsed : null;
  } else if (process.platform === 'linux') {
    const lscpu = await run('lscpu', []);
    const modelMatch = lscpu.stdout.match(/^Model name:\s*(.+)$/mu);
    const socketsMatch = lscpu.stdout.match(/^Socket\(s\):\s*(\d+)$/mu);
    const coresMatch = lscpu.stdout.match(/^Core\(s\) per socket:\s*(\d+)$/mu);
    model = modelMatch?.[1]?.trim() ?? model;
    if (socketsMatch?.[1] !== undefined && coresMatch?.[1] !== undefined) {
      physicalCores = Number(socketsMatch[1]) * Number(coresMatch[1]);
    }
  }

  return {
    model,
    logicalCores: os.cpus().length,
    physicalCores,
    architecture: os.arch(),
  };
}

function parseMemoryValue(value: string): number | null {
  const match = value.match(/([\d.]+)\s*(GB|MB)/iu);
  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }

  const amount = Number(match[1]);
  return Math.round(amount * (match[2].toUpperCase() === 'GB' ? 1024 ** 3 : 1024 ** 2));
}

async function detectGpus(): Promise<{ devices: GpuInfo[]; graphicsApis: string[] }> {
  const devices: GpuInfo[] = [];
  const graphicsApis = new Set<string>();

  if (process.platform === 'darwin') {
    const displays = await run('system_profiler', ['SPDisplaysDataType']);
    const models = [...displays.stdout.matchAll(/^\s{4,8}Chipset Model:\s*(.+)$/gmu)].map((match) =>
      match[1]?.trim(),
    );
    const vramValues = [...displays.stdout.matchAll(/^\s*VRAM.*:\s*(.+)$/gmu)].map((match) =>
      parseMemoryValue(match[1] ?? ''),
    );
    const metal = displays.stdout.match(/^\s*Metal Support:\s*(.+)$/mu)?.[1]?.trim();

    if (metal !== undefined) {
      graphicsApis.add(metal);
    }

    models.forEach((model, index) => {
      if (model === undefined) {
        return;
      }
      devices.push({
        model,
        vendor: 'Apple',
        memoryBytes: vramValues[index] ?? null,
        details: ['Unified memory architecture'],
      });
    });
  } else if (process.platform === 'linux') {
    const lspci = await run('lspci', []);
    const displayLines = lspci.stdout
      .split(/\r?\n/u)
      .filter((line) =>
        /(?:VGA compatible controller|3D controller|Display controller)/iu.test(line),
      );

    for (const line of displayLines) {
      const model = line.replace(/^.*?:\s*/u, '').trim();
      const vendor = /nvidia/iu.test(model)
        ? 'NVIDIA'
        : /amd|ati/iu.test(model)
          ? 'AMD'
          : /intel/iu.test(model)
            ? 'Intel'
            : null;
      devices.push({ model, vendor, memoryBytes: null, details: [] });
    }

    const nvidia = await run('nvidia-smi', [
      '--query-gpu=name,memory.total',
      '--format=csv,noheader,nounits',
    ]);
    if (nvidia.exitCode === 0) {
      graphicsApis.add('CUDA');
      for (const line of nvidia.stdout.split(/\r?\n/u)) {
        const [name, memoryMib] = line.split(',').map((part) => part.trim());
        if (name !== undefined && memoryMib !== undefined) {
          const existing = devices.find((device) => device.model.includes(name));
          const memoryBytes = Number(memoryMib) * 1024 ** 2;
          if (existing !== undefined) {
            existing.memoryBytes = memoryBytes;
          } else {
            devices.push({
              model: name,
              vendor: 'NVIDIA',
              memoryBytes,
              details: [],
            });
          }
        }
      }
    }

    if (await pathExists('/dev/dri')) {
      graphicsApis.add('DRM');
    }
    if (await commandExists('vainfo')) {
      const vainfo = await run('vainfo', ['--display', 'drm'], 5_000);
      if (vainfo.exitCode === 0) {
        graphicsApis.add('VA-API');
      }
    }
    if (await commandExists('vulkaninfo')) {
      const vulkan = await run('vulkaninfo', ['--summary'], 5_000);
      if (vulkan.exitCode === 0) {
        graphicsApis.add('Vulkan');
      }
    }
  }

  return {
    devices:
      devices.length > 0
        ? devices
        : [{ model: 'No GPU detected', vendor: null, memoryBytes: null, details: [] }],
    graphicsApis: [...graphicsApis],
  };
}

async function detectWorkspaceStorage(): Promise<{
  mount: string;
  filesystem: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}> {
  const result = await run('df', ['-kP', process.cwd()]);
  const line = result.stdout.split(/\r?\n/u).at(-1) ?? '';
  const parts = line.trim().split(/\s+/u);
  if (parts.length < 6) {
    return {
      mount: process.cwd(),
      filesystem: 'unknown',
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
    };
  }

  const [filesystem = 'unknown', total = '0', used = '0', free = '0'] = parts;
  return {
    mount: parts.slice(5).join(' '),
    filesystem,
    totalBytes: Number(total) * bytesPerKibibyte,
    usedBytes: Number(used) * bytesPerKibibyte,
    freeBytes: Number(free) * bytesPerKibibyte,
  };
}

function parseEncoders(output: string): Array<{
  name: string;
  mediaType: string;
  description: string;
}> {
  const encoders: Array<{ name: string; mediaType: string; description: string }> = [];
  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^\s*([VAS])([A-Z.]{5})\s+(\S+)\s+(.+)$/u);
    if (match?.[1] === undefined || match[3] === undefined || match[4] === undefined) {
      continue;
    }
    encoders.push({
      name: match[3],
      mediaType: match[1] === 'V' ? 'video' : match[1] === 'A' ? 'audio' : 'subtitle',
      description: match[4].trim(),
    });
  }
  return encoders;
}

function parseCodecSummary(output: string): CodecSummary {
  let count = 0;
  let h264 = { decode: false, encode: false, description: null as string | null };
  let aac = { decode: false, encode: false, description: null as string | null };

  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^\s*([D.])([E.])([VASD])([I.])([L.])([S.])\s+(\S+)\s+(.+)$/u);
    if (match?.[7] === undefined || match[8] === undefined) {
      continue;
    }
    count += 1;
    const value = {
      decode: match[1] === 'D',
      encode: match[2] === 'E',
      description: match[8].trim(),
    };
    if (match[7] === 'h264') {
      h264 = value;
    } else if (match[7] === 'aac') {
      aac = value;
    }
  }

  return { count, h264, aac };
}

async function detectFfmpeg(): Promise<{
  available: boolean;
  version: string | null;
  configuration: string | null;
  h264Encoders: string[];
  hardwareH264Encoders: string[];
  codecs: CodecSummary;
}> {
  const version = await run('ffmpeg', ['-version']);
  if (!version.available || version.exitCode !== 0) {
    return {
      available: false,
      version: null,
      configuration: null,
      h264Encoders: [],
      hardwareH264Encoders: [],
      codecs: {
        count: 0,
        h264: { decode: false, encode: false, description: null },
        aac: { decode: false, encode: false, description: null },
      },
    };
  }

  const encoderResult = await run('ffmpeg', ['-hide_banner', '-encoders']);
  const encoders = parseEncoders(`${encoderResult.stdout}\n${encoderResult.stderr}`);
  const h264Encoders = encoders
    .filter(
      (encoder) =>
        encoder.mediaType === 'video' &&
        (encoder.name.includes('264') || /H\.264|AVC/iu.test(encoder.description)),
    )
    .map((encoder) => encoder.name);
  const softwareEncoders = new Set(['libx264', 'libx264rgb']);
  const codecResult = await run('ffmpeg', ['-hide_banner', '-codecs']);

  return {
    available: true,
    version: firstLine(version.stdout),
    configuration:
      version.stdout.split(/\r?\n/u).find((line) => line.startsWith('configuration:')) ?? null,
    h264Encoders: [...new Set(h264Encoders)].sort(),
    hardwareH264Encoders: h264Encoders.filter((encoder) => !softwareEncoders.has(encoder)).sort(),
    codecs: parseCodecSummary(`${codecResult.stdout}\n${codecResult.stderr}`),
  };
}

async function detectTool(
  command: string,
  args: readonly string[] = ['--version'],
): Promise<{ available: boolean; version: string | null }> {
  const available = await commandExists(command);
  if (!available) {
    return { available: false, version: null };
  }
  const result = await run(command, args, 6_000);
  return {
    available: true,
    version: firstLine(result.stdout || result.stderr),
  };
}

async function detectDocker(): Promise<{
  available: boolean;
  version: string | null;
  daemonResponding: boolean;
  serverVersion: string | null;
}> {
  const tool = await detectTool('docker', ['--version']);
  if (!tool.available) {
    return {
      available: false,
      version: null,
      daemonResponding: false,
      serverVersion: null,
    };
  }

  const server = await run('docker', ['info', '--format', '{{.ServerVersion}}'], 6_000);
  return {
    ...tool,
    daemonResponding: server.exitCode === 0,
    serverVersion: server.exitCode === 0 ? firstLine(server.stdout) : null,
  };
}

async function endpointResponding(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1_500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function detectLlmRuntimes(): Promise<RuntimeProbe[]> {
  const definitions = [
    {
      name: 'Ollama',
      command: 'ollama',
      args: ['--version'],
      endpoint: 'http://127.0.0.1:11434/api/version',
      notes: ['OpenAI-compatible use requires an adapter or compatibility endpoint.'],
    },
    {
      name: 'llama.cpp server',
      command: 'llama-server',
      args: ['--version'],
      endpoint: 'http://127.0.0.1:8080/health',
      notes: ['Endpoint probe is local-only.'],
    },
    {
      name: 'LM Studio',
      command: 'lms',
      args: ['--version'],
      endpoint: 'http://127.0.0.1:1234/v1/models',
      notes: ['Endpoint probe is local-only.'],
    },
    {
      name: 'MLX LM',
      command: 'mlx_lm.generate',
      args: ['--help'],
      endpoint: null,
      notes: ['Apple Silicon development runtime.'],
    },
  ] as const;

  return Promise.all(
    definitions.map(async (definition) => {
      const tool = await detectTool(definition.command, definition.args);
      return {
        name: definition.name,
        commandAvailable: tool.available,
        version: tool.version,
        localEndpointResponding:
          definition.endpoint === null ? null : await endpointResponding(definition.endpoint),
        notes: [...definition.notes],
      };
    }),
  );
}

async function inventoryModelDirectory(
  source: string,
  directory: string,
  depth = 0,
): Promise<ModelInventory> {
  if (!(await pathExists(directory))) {
    return { source, present: false, fileCount: 0, totalBytes: 0, formats: [] };
  }

  let fileCount = 0;
  let totalBytes = 0;
  const formats = new Set<string>();

  async function visit(current: string, currentDepth: number): Promise<void> {
    if (currentDepth > 6 || fileCount > 20_000) {
      return;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath, currentDepth + 1);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      const isOllamaBlob = source === 'Ollama' && entry.name.startsWith('sha256-');
      if (!modelExtensions.has(extension) && !isOllamaBlob) {
        continue;
      }
      try {
        const file = await stat(entryPath);
        fileCount += 1;
        totalBytes += file.size;
        formats.add(isOllamaBlob ? 'ollama-blob' : extension.slice(1));
      } catch {
        // Model inventories are best-effort and must not fail the host diagnostic.
      }
    }
  }

  await visit(directory, depth);
  return {
    source,
    present: true,
    fileCount,
    totalBytes,
    formats: [...formats].sort(),
  };
}

async function detectModelFiles(): Promise<ModelInventory[]> {
  const home = os.homedir();
  const locations = [
    ['Ollama', path.join(home, '.ollama', 'models')],
    ['Hugging Face cache', path.join(home, '.cache', 'huggingface', 'hub')],
    ['llama.cpp cache', path.join(home, '.cache', 'llama.cpp')],
    ['LM Studio', path.join(home, 'Library', 'Application Support', 'LM Studio', 'models')],
  ] as const;

  return Promise.all(
    locations.map(async ([source, directory]) => inventoryModelDirectory(source, directory)),
  );
}

async function detectTtsRuntimes(): Promise<RuntimeProbe[]> {
  const definitions = [
    ['Piper', 'piper', ['--version'], ['Preferred lightweight local Linux candidate.']],
    ['Coqui TTS', 'tts', ['--version'], ['Heavier Python runtime.']],
    ['eSpeak NG', 'espeak-ng', ['--version'], ['Basic fallback voice.']],
    ['eSpeak', 'espeak', ['--version'], ['Basic fallback voice.']],
    ['macOS say', 'say', ['--help'], ['Development-only native macOS fallback.']],
  ] as const;

  return Promise.all(
    definitions.map(async ([name, command, args, notes]) => {
      const tool = await detectTool(command, args);
      return {
        name,
        commandAvailable: tool.available,
        version: tool.version,
        localEndpointResponding: null,
        notes: [...notes],
      };
    }),
  );
}

function detectNetworkInterfaces(): Array<{
  name: string;
  ipv4Addresses: number;
  ipv6Addresses: number;
  externalAddresses: number;
}> {
  return Object.entries(os.networkInterfaces())
    .map(([name, addresses]) => ({
      name,
      ipv4Addresses: addresses?.filter((address) => address.family === 'IPv4').length ?? 0,
      ipv6Addresses: addresses?.filter((address) => address.family === 'IPv6').length ?? 0,
      externalAddresses: addresses?.filter((address) => !address.internal).length ?? 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function recommendProfile(input: {
  memoryBytes: number;
  logicalCores: number;
  gpuDetected: boolean;
}): { profile: 'Minimal' | 'Standard' | 'Enhanced'; rationale: string[] } {
  const memoryGib = input.memoryBytes / 1024 ** 3;
  if (memoryGib >= 96 && input.logicalCores >= 16 && input.gpuDetected) {
    return {
      profile: 'Enhanced',
      rationale: [
        'At least 96 GiB RAM is available.',
        'At least 16 logical CPU cores are available.',
        'A graphics device was detected.',
      ],
    };
  }
  if (memoryGib >= 32 && input.logicalCores >= 12 && input.gpuDetected) {
    return {
      profile: 'Standard',
      rationale: [
        'At least 32 GiB RAM is available.',
        'At least 12 logical CPU cores are available.',
        'A graphics device was detected.',
      ],
    };
  }
  return {
    profile: 'Minimal',
    rationale: [
      'Minimal is the safest unattended starting profile.',
      'Higher profiles require successful renderer and encoder benchmarks.',
    ],
  };
}

async function main(): Promise<void> {
  const output = resolveFromWorkspace(readArg('output', 'data/system-profile.json') ?? '');
  const [operatingSystem, cpu, graphics, storage, ffmpeg, node, pnpm, docker, llm, models, tts] =
    await Promise.all([
      detectOperatingSystem(),
      detectCpu(),
      detectGpus(),
      detectWorkspaceStorage(),
      detectFfmpeg(),
      detectTool('node', ['--version']),
      detectTool('pnpm', ['--version']),
      detectDocker(),
      detectLlmRuntimes(),
      detectModelFiles(),
      detectTtsRuntimes(),
    ]);
  const memoryBytes = os.totalmem();
  const gpuDetected = graphics.devices.some((device) => device.model !== 'No GPU detected');
  const recommendation = recommendProfile({
    memoryBytes,
    logicalCores: cpu.logicalCores,
    gpuDetected,
  });
  const host = os.hostname();
  const profile = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      kind: 'live-local-diagnostic',
      workspace: path.basename(process.cwd()),
      note:
        host.toLowerCase() === 'endor'
          ? 'Captured directly on the production host.'
          : 'Development-host capture. Run pnpm diagnose directly on Endor before production deployment.',
    },
    host: {
      hostname: host,
      productionHostMatch: host.toLowerCase() === 'endor',
    },
    operatingSystem,
    cpu,
    memory: {
      totalBytes: memoryBytes,
      totalGiB: Number((memoryBytes / 1024 ** 3).toFixed(2)),
    },
    graphics,
    storage,
    network: {
      interfaces: detectNetworkInterfaces(),
      uploadBandwidthMbps: null,
      uploadMeasurement:
        'Not measured automatically. Use the documented sustained RTMPS-safe test from Endor.',
    },
    tools: {
      node,
      pnpm,
      docker,
      ffmpeg,
    },
    localAi: {
      llmRuntimes: llm,
      modelFiles: models,
      ttsRuntimes: tts,
      largeModelsInstalledByDiagnostic: false,
    },
    recommendation,
    safety: {
      publicStreamStarted: false,
      firewallModified: false,
      routerModified: false,
      secretsCollected: false,
      networkAddressesRedacted: true,
    },
  };

  await writeJson(output, profile);
  process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
  process.stderr.write(`Wrote system profile to ${path.relative(process.cwd(), output)}\n`);
}

await main();
