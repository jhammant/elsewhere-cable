import './style.css';
import { calculateFrameStats, type FrameStats } from './metrics.js';
import { HybridBroadcastScene } from './hybrid-scene.js';
import { PlayoutEngine } from './playout.js';
import { DeferredRendererActivation, rendererRuntimeMode } from './runtime.js';

interface BenchmarkResult extends FrameStats {
  completed: boolean;
  targetFps: number;
  durationSeconds: number;
  capturedAt: string;
  renderer: {
    api: string;
    device: string;
    vendor: string;
  };
}

declare global {
  interface Window {
    __ELSEWHERE_BENCHMARK__: BenchmarkResult | null;
    __ELSEWHERE_RENDERER_READY__: boolean;
    __ELSEWHERE_RENDERER_ACTIVE__: boolean;
    __ELSEWHERE_ACTIVATE__: () => Promise<boolean>;
  }
}

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing required renderer element: ${selector}`);
  }
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>('#programme-canvas');
const canvas2d = requiredElement<HTMLCanvasElement>('#programme-2d-canvas');
const broadcast = requiredElement<HTMLElement>('#broadcast');
const fpsValue = requiredElement<HTMLElement>('#fps-value');
const rendererApi = requiredElement<HTMLElement>('#renderer-api');
const broadcastTime = requiredElement<HTMLTimeElement>('#broadcast-time');
const scene = new HybridBroadcastScene(canvas, canvas2d);
const renderer = scene.getRendererInfo();
const params = new URLSearchParams(window.location.search);
const runtimeMode = rendererRuntimeMode(params);
const standbyMode = runtimeMode === 'standby';
const benchmarkSeconds = Math.max(3, Number(params.get('seconds') ?? 15));
const targetFps = 25;
const targetFrameTimeMs = 1000 / targetFps;
const frameTimes: number[] = [];
let previousFrame = performance.now();
let previousAnimationFrame = previousFrame;
let renderAccumulatorMs = 0;
let recentFrameTimes: number[] = [];
let benchmarkStart = previousFrame;
window.__ELSEWHERE_BENCHMARK__ = null;
window.__ELSEWHERE_RENDERER_READY__ = false;
window.__ELSEWHERE_RENDERER_ACTIVE__ = false;

rendererApi.textContent = renderer.api;
rendererApi.title = `${renderer.vendor} — ${renderer.device}`;
if (standbyMode) {
  broadcast.classList.add('handover-standby');
}

const activation = new DeferredRendererActivation(async () => {
  const playout = new PlayoutEngine(scene);
  await playout.start();
  broadcast.classList.remove('handover-standby');
  broadcast.dataset.rendererActive = 'true';
  window.__ELSEWHERE_RENDERER_ACTIVE__ = true;
});
window.__ELSEWHERE_ACTIVATE__ = () => activation.activate();

function updateClock(now: number): void {
  const totalSeconds = Math.floor(now / 1000);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  broadcastTime.textContent = [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

function animate(now: number): void {
  const animationFrameTime = now - previousAnimationFrame;
  previousAnimationFrame = now;
  if (animationFrameTime > 0 && animationFrameTime < 1000) {
    renderAccumulatorMs += animationFrameTime;
  }

  if (renderAccumulatorMs < targetFrameTimeMs) {
    requestAnimationFrame(animate);
    return;
  }
  renderAccumulatorMs %= targetFrameTimeMs;

  const frameTime = now - previousFrame;
  previousFrame = now;

  if (frameTime > 0 && frameTime < 1000) {
    frameTimes.push(frameTime);
    recentFrameTimes.push(frameTime);
  }
  if (recentFrameTimes.length > 30) {
    recentFrameTimes = recentFrameTimes.slice(-30);
  }

  scene.render();
  updateClock(now);
  if (!window.__ELSEWHERE_RENDERER_READY__) {
    window.__ELSEWHERE_RENDERER_READY__ = true;
    broadcast.dataset.rendererReady = 'true';
  }

  if (frameTimes.length % 15 === 0 && recentFrameTimes.length > 0) {
    fpsValue.textContent = calculateFrameStats(recentFrameTimes, targetFps).averageFps.toFixed(0);
  }

  if (window.__ELSEWHERE_BENCHMARK__ === null && now - benchmarkStart >= benchmarkSeconds * 1000) {
    window.__ELSEWHERE_BENCHMARK__ = {
      ...calculateFrameStats(frameTimes, targetFps),
      completed: true,
      targetFps,
      durationSeconds: Number(((now - benchmarkStart) / 1000).toFixed(2)),
      capturedAt: new Date().toISOString(),
      renderer,
    };
    broadcast.dataset.benchmarkComplete = 'true';
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame((now) => {
  previousFrame = now;
  previousAnimationFrame = now;
  benchmarkStart = now;
  requestAnimationFrame(animate);
});

if (runtimeMode === 'live') {
  void window.__ELSEWHERE_ACTIVATE__();
}

window.addEventListener('beforeunload', () => {
  scene.dispose();
});
