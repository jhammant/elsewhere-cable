export type RendererRuntimeMode = 'benchmark' | 'standby' | 'live';

export function rendererRuntimeMode(parameters: URLSearchParams): RendererRuntimeMode {
  if (parameters.has('benchmark')) {
    return 'benchmark';
  }
  return parameters.has('standby') ? 'standby' : 'live';
}

export class DeferredRendererActivation {
  private state: 'standby' | 'activating' | 'active' = 'standby';
  private pending: Promise<boolean> | null = null;

  constructor(private readonly start: () => Promise<void>) {}

  get isActive(): boolean {
    return this.state === 'active';
  }

  get isActivating(): boolean {
    return this.state === 'activating';
  }

  activate(): Promise<boolean> {
    if (this.state === 'active') {
      return Promise.resolve(false);
    }
    if (this.pending !== null) {
      return this.pending;
    }
    this.state = 'activating';
    this.pending = this.start()
      .then(() => {
        this.state = 'active';
        return true;
      })
      .catch((error: unknown) => {
        this.state = 'standby';
        this.pending = null;
        throw error;
      });
    return this.pending;
  }
}
