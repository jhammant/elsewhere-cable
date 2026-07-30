import type { SegmentPackage } from '@elsewhere-cable/schemas';
import type { PlayoutVisuals } from './playout.js';
import { Broadcast2DScene, usesTwoDimensionalRenderer } from './scene-2d.js';
import { BroadcastScene } from './scene.js';

export class HybridBroadcastScene implements PlayoutVisuals {
  private readonly threeDimensional: BroadcastScene;
  private readonly twoDimensional: Broadcast2DScene;
  private active: PlayoutVisuals;
  private isTwoDimensional = false;

  constructor(
    private readonly threeDimensionalCanvas: HTMLCanvasElement,
    private readonly twoDimensionalCanvas: HTMLCanvasElement,
  ) {
    this.threeDimensional = new BroadcastScene(threeDimensionalCanvas);
    this.twoDimensional = new Broadcast2DScene(twoDimensionalCanvas);
    this.active = this.threeDimensional;
    this.applyVisibility();
  }

  loadSegment(segment: SegmentPackage): void {
    this.isTwoDimensional = usesTwoDimensionalRenderer(segment);
    this.active = this.isTwoDimensional ? this.twoDimensional : this.threeDimensional;
    this.active.loadSegment(segment);
    this.applyVisibility();
  }

  cutCamera(camera: 'CAMERA_WIDE' | 'CAMERA_HOST' | 'CAMERA_GUEST'): void {
    this.active.cutCamera(camera);
  }

  speak(characterId: string, durationMs: number): void {
    this.active.speak(characterId, durationMs);
  }

  performAction(characterId: string, action: Parameters<PlayoutVisuals['performAction']>[1]): void {
    this.active.performAction(characterId, action);
  }

  performStoryCue(cue: Parameters<PlayoutVisuals['performStoryCue']>[0]): void {
    this.active.performStoryCue(cue);
  }

  render(): void {
    if (this.isTwoDimensional) {
      this.twoDimensional.render();
    } else {
      this.threeDimensional.render();
    }
  }

  getRendererInfo(): { api: string; device: string; vendor: string } {
    return this.threeDimensional.getRendererInfo();
  }

  dispose(): void {
    this.twoDimensional.dispose();
    this.threeDimensional.dispose();
  }

  private applyVisibility(): void {
    this.threeDimensionalCanvas.style.visibility = this.isTwoDimensional ? 'hidden' : 'visible';
    this.twoDimensionalCanvas.style.visibility = this.isTwoDimensional ? 'visible' : 'hidden';
  }
}
