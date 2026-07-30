import { describe, expect, it, vi } from 'vitest';
import { DeferredRendererActivation, rendererRuntimeMode } from './runtime.js';

describe('renderer handover runtime', () => {
  it('keeps a standby renderer silent until it is explicitly activated', () => {
    expect(rendererRuntimeMode(new URLSearchParams('broadcast=1&standby=1'))).toBe('standby');
    expect(rendererRuntimeMode(new URLSearchParams('broadcast=1'))).toBe('live');
    expect(rendererRuntimeMode(new URLSearchParams('benchmark=1&standby=1'))).toBe('benchmark');
  });

  it('starts playout once when activation requests overlap', async () => {
    let release = (): void => undefined;
    const start = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const activation = new DeferredRendererActivation(start);

    const first = activation.activate();
    const second = activation.activate();
    expect(activation.isActivating).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);

    release();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    await expect(activation.activate()).resolves.toBe(false);
    expect(activation.isActive).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('can retry activation after a failed start', async () => {
    const start = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('manifest unavailable'))
      .mockResolvedValueOnce();
    const activation = new DeferredRendererActivation(start);

    await expect(activation.activate()).rejects.toThrow('manifest unavailable');
    expect(activation.isActive).toBe(false);
    await expect(activation.activate()).resolves.toBe(true);
    expect(start).toHaveBeenCalledTimes(2);
  });
});
