import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import { playoutManifestSchema, segmentPackageSchema } from '@elsewhere-cable/schemas';
import Fastify from 'fastify';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(sourceDirectory, '../../..');
const rendererRoot = path.join(workspaceRoot, 'apps/renderer/dist');
const segmentsRoot = path.resolve(
  workspaceRoot,
  process.env.ELSEWHERE_SEGMENTS_DIR ?? 'data/segments',
);
const manifestPath = path.join(segmentsRoot, 'manifest.json');
const host = process.env.ELSEWHERE_HOST ?? '127.0.0.1';
const port = Number(process.env.ELSEWHERE_PORT ?? 4174);
const startedAt = Date.now();

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('ELSEWHERE_PORT must be a valid TCP port');
}

async function readManifest() {
  try {
    return playoutManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        schemaVersion: 1 as const,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 0,
        segments: [],
      };
    }
    throw error;
  }
}

const app = Fastify({
  logger: {
    level: process.env.ELSEWHERE_LOG_LEVEL ?? 'info',
  },
});

app.get('/health/live', () => ({
  status: 'live',
  service: 'playout-controller',
  uptimeSeconds: Math.floor((Date.now() - startedAt) / 1_000),
}));

app.get('/health/ready', async (_request, reply) => {
  try {
    const manifest = await readManifest();
    return {
      status: manifest.segments.length > 0 ? 'ready' : 'fallback',
      segmentCount: manifest.segments.length,
      bufferDurationMs: manifest.totalDurationMs,
    };
  } catch (error) {
    reply.code(503);
    return {
      status: 'invalid-manifest',
      error: error instanceof Error ? error.message : 'Unknown manifest error',
    };
  }
});

app.get('/api/playout/manifest', async () => readManifest());

app.get('/api/playout/state', async () => {
  const manifest = await readManifest();
  const bufferMinutes = manifest.totalDurationMs / 60_000;
  return {
    service: 'playout-controller',
    host: os.hostname(),
    streamState: 'local-preview',
    segmentCount: manifest.segments.length,
    bufferDurationMs: manifest.totalDurationMs,
    bufferState:
      bufferMinutes > 10
        ? 'healthy'
        : bufferMinutes >= 5
          ? 'warning'
          : manifest.segments.length > 0
            ? 'critical'
            : 'fallback',
    controllerResidentMemoryBytes: process.memoryUsage().rss,
    publicStreamActive: false,
  };
});

app.get('/api/playout/segments/:segmentId', async (request, reply) => {
  const parameters = request.params as { segmentId: string };
  if (!/^seg_[a-z0-9_]+$/u.test(parameters.segmentId)) {
    return reply.code(400).send({ error: 'Invalid segment ID' });
  }
  try {
    const content = await readFile(
      path.join(segmentsRoot, parameters.segmentId, 'segment.json'),
      'utf8',
    );
    return segmentPackageSchema.parse(JSON.parse(content));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return reply.code(404).send({ error: 'Segment not found' });
    }
    throw error;
  }
});

await app.register(fastifyStatic, {
  root: segmentsRoot,
  prefix: '/segments/',
  decorateReply: false,
});

await app.register(fastifyStatic, {
  root: rendererRoot,
  prefix: '/',
});

app.setNotFoundHandler(async (request, reply) => {
  if (request.raw.url?.startsWith('/api/') === true) {
    return reply.code(404).send({ error: 'Not found' });
  }
  return reply.sendFile('index.html', rendererRoot);
});

await app.listen({ host, port });
app.log.info(
  {
    event: 'playout.ready',
    host,
    port,
    segmentsRoot,
    publicStreamActive: false,
  },
  `Elsewhere Cable local playout is ready at http://${host}:${port}`,
);

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ event: 'playout.shutdown', signal }, 'Stopping local playout');
  await app.close();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
