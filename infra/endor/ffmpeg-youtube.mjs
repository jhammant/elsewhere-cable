import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const [secretPath, streamBaseUrl, ...ffmpegArguments] = process.argv.slice(2);
if (secretPath === undefined || streamBaseUrl === undefined) {
  throw new Error('Usage: ffmpeg-youtube <secret-path> <stream-base-url> <ffmpeg arguments...>');
}

const streamKey = (await readFile(secretPath, 'utf8')).replaceAll(/[\r\n]/gu, '');
if (streamKey.length === 0) {
  throw new Error('YouTube stream key file is empty');
}

const child = spawn(
  'ffmpeg',
  [...ffmpegArguments, '-f', 'flv', `${streamBaseUrl.replace(/\/$/u, '')}/${streamKey}`],
  {
    stdio: ['inherit', 'inherit', 'pipe'],
  },
);

let pendingLog = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => {
  pendingLog += chunk;
  for (;;) {
    const lineFeed = pendingLog.indexOf('\n');
    const carriageReturn = pendingLog.indexOf('\r');
    const candidates = [lineFeed, carriageReturn].filter((index) => index >= 0);
    if (candidates.length === 0) {
      break;
    }
    const boundary = Math.min(...candidates) + 1;
    process.stderr.write(pendingLog.slice(0, boundary).replaceAll(streamKey, '[REDACTED]'));
    pendingLog = pendingLog.slice(boundary);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('error', (error) => {
  process.stderr.write(`Could not start FFmpeg: ${error.message}\n`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (pendingLog.length > 0) {
    process.stderr.write(pendingLog.replaceAll(streamKey, '[REDACTED]'));
  }
  if (signal !== null) {
    process.stderr.write(`FFmpeg stopped by ${signal}\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
