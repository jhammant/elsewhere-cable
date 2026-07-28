import { spawn } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';
import { readArg, readNumberArg } from './lib/args.js';
import { run } from './lib/command.js';
import { resolveFromWorkspace, writeJson } from './lib/files.js';

interface ResourceSample {
  cpuPercent: number;
  residentMemoryBytes: number;
}

interface EncoderRun {
  encoder: string;
  exitCode: number | null;
  wallTimeSeconds: number;
  encodedDurationSeconds: number;
  speed: number | null;
  frames: number;
  resourceSamples: ResourceSample[];
  stderrTail: string;
}

function encoderArgs(encoder: string): string[] {
  switch (encoder) {
    case 'h264_videotoolbox':
      return ['-c:v', encoder, '-realtime', '1', '-allow_sw', '0', '-b:v', '3500k'];
    case 'h264_nvenc':
      return ['-c:v', encoder, '-preset', 'p4', '-tune', 'll', '-b:v', '3500k'];
    case 'h264_qsv':
      return ['-vf', 'format=nv12', '-c:v', encoder, '-preset', 'veryfast', '-b:v', '3500k'];
    case 'h264_vaapi':
      return [
        '-vaapi_device',
        '/dev/dri/renderD128',
        '-vf',
        'format=nv12,hwupload',
        '-c:v',
        encoder,
        '-b:v',
        '3500k',
      ];
    case 'h264_amf':
      return ['-c:v', encoder, '-quality', 'speed', '-b:v', '3500k'];
    case 'libx264':
      return ['-c:v', encoder, '-preset', 'veryfast', '-tune', 'zerolatency', '-b:v', '3500k'];
    default:
      return ['-c:v', encoder, '-b:v', '3500k'];
  }
}

async function listedH264Encoders(): Promise<string[]> {
  const result = await run('ffmpeg', ['-hide_banner', '-encoders']);
  if (result.exitCode !== 0) {
    throw new Error('FFmpeg is required for the encoder benchmark.');
  }
  return `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*V[A-Z.]{5}\s+(\S+)/u)?.[1])
    .filter((name): name is string => name !== undefined && name.includes('264'));
}

async function chooseEncoders(requested: string | undefined): Promise<string[]> {
  const available = await listedH264Encoders();
  if (requested !== undefined) {
    if (!available.includes(requested)) {
      throw new Error(`Requested encoder ${requested} is not listed by FFmpeg.`);
    }
    return [requested];
  }

  const platformOrder =
    process.platform === 'darwin'
      ? ['h264_videotoolbox', 'libx264']
      : ['h264_nvenc', 'h264_qsv', 'h264_vaapi', 'h264_amf', 'libx264'];
  return platformOrder.filter((encoder) => available.includes(encoder));
}

async function sampleProcess(pid: number): Promise<ResourceSample | null> {
  const result = await run('ps', ['-p', String(pid), '-o', '%cpu=', '-o', 'rss='], 2_000);
  const match = result.stdout.trim().match(/^([\d.]+)\s+(\d+)$/u);
  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }
  return {
    cpuPercent: Number(match[1]),
    residentMemoryBytes: Number(match[2]) * 1024,
  };
}

async function runEncoder(encoder: string, durationSeconds: number): Promise<EncoderRun> {
  const args = [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=1280x720:rate=25:duration=${durationSeconds}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:sample_rate=48000:duration=${durationSeconds}`,
    ...encoderArgs(encoder),
    '-pix_fmt',
    'yuv420p',
    '-r',
    '25',
    '-g',
    '50',
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-b:a',
    '160k',
    '-shortest',
    '-progress',
    'pipe:2',
    '-f',
    'null',
    '-',
  ];
  const started = process.hrtime.bigint();
  const child = spawn('ffmpeg', args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const resourceSamples: ResourceSample[] = [];
  let stderr = '';
  let frames = 0;
  let encodedDurationSeconds = 0;
  let speed: number | null = null;

  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
    if (stderr.length > 250_000) {
      stderr = stderr.slice(-150_000);
    }
    for (const line of stderr.slice(-20_000).split(/\r?\n/u)) {
      if (line.startsWith('frame=')) {
        frames = Number(line.slice('frame='.length)) || frames;
      } else if (line.startsWith('out_time_us=')) {
        encodedDurationSeconds = Number(line.slice('out_time_us='.length)) / 1_000_000;
      } else if (line.startsWith('speed=')) {
        speed = Number(line.slice('speed='.length).replace('x', '')) || speed;
      }
    }
  });

  const sampler = setInterval(() => {
    if (child.pid === undefined) {
      return;
    }
    void sampleProcess(child.pid).then((sample) => {
      if (sample !== null) {
        resourceSamples.push(sample);
      }
    });
  }, 500);

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  clearInterval(sampler);
  const wallTimeSeconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;

  return {
    encoder,
    exitCode,
    wallTimeSeconds,
    encodedDurationSeconds,
    speed,
    frames,
    resourceSamples,
    stderrTail: stderr.slice(-8_000),
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main(): Promise<void> {
  const durationSeconds = readNumberArg('duration', 1800);
  const requested = readArg('encoder');
  const candidates = await chooseEncoders(requested);
  if (candidates.length === 0) {
    throw new Error('FFmpeg does not list a supported H.264 encoder.');
  }

  const attempts: EncoderRun[] = [];
  let successful: EncoderRun | null = null;
  for (const encoder of candidates) {
    process.stderr.write(`Benchmarking ${encoder} with ${durationSeconds}s of 720p25 source…\n`);
    const attempt = await runEncoder(encoder, durationSeconds);
    attempts.push(attempt);
    if (
      attempt.exitCode === 0 &&
      attempt.encodedDurationSeconds >= durationSeconds - 1 &&
      attempt.frames >= durationSeconds * 25 - 25
    ) {
      successful = attempt;
      break;
    }
    process.stderr.write(`${encoder} failed; trying the next safe encoder.\n`);
  }

  const output = resolveFromWorkspace('data/benchmarks/encoder.json');
  const result = {
    schemaVersion: 1,
    host: os.hostname(),
    source: {
      resolution: { width: 1280, height: 720 },
      frameRate: 25,
      durationSeconds,
      videoFrames: durationSeconds * 25,
      pattern: 'FFmpeg testsrc2',
      audio: '48 kHz generated sine wave',
      output: 'FFmpeg null muxer; no large benchmark media retained',
    },
    selectedEncoder: successful?.encoder ?? null,
    passed: successful !== null,
    performance:
      successful === null
        ? null
        : {
            wallTimeSeconds: Number(successful.wallTimeSeconds.toFixed(2)),
            realtimeFactor:
              successful.speed ??
              Number((successful.encodedDurationSeconds / successful.wallTimeSeconds).toFixed(2)),
            averageCpuPercent: Number(
              average(successful.resourceSamples.map((sample) => sample.cpuPercent)).toFixed(2),
            ),
            peakCpuPercent: Number(
              Math.max(0, ...successful.resourceSamples.map((sample) => sample.cpuPercent)).toFixed(
                2,
              ),
            ),
            averageResidentMemoryBytes: Math.round(
              average(successful.resourceSamples.map((sample) => sample.residentMemoryBytes)),
            ),
            peakResidentMemoryBytes: Math.max(
              0,
              ...successful.resourceSamples.map((sample) => sample.residentMemoryBytes),
            ),
            sampleCount: successful.resourceSamples.length,
          },
    attempts: attempts.map((attempt) => ({
      encoder: attempt.encoder,
      exitCode: attempt.exitCode,
      wallTimeSeconds: Number(attempt.wallTimeSeconds.toFixed(2)),
      encodedDurationSeconds: Number(attempt.encodedDurationSeconds.toFixed(2)),
      frames: attempt.frames,
      errorTail: attempt.exitCode === 0 ? null : attempt.stderrTail.slice(-2_000),
    })),
    capturedAt: new Date().toISOString(),
  };

  await writeJson(output, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) {
    process.exitCode = 1;
  }
}

await main();
