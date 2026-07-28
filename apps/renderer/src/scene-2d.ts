import type { SegmentPackage } from '@elsewhere-cable/schemas';
import type { PlayoutVisuals } from './playout.js';
import { resolveProductionDesign, type VisualMedium } from './production-design.js';

type CameraName = 'CAMERA_WIDE' | 'CAMERA_HOST' | 'CAMERA_GUEST';
type CharacterAction = Parameters<PlayoutVisuals['performAction']>[1];

interface DrawnCharacter {
  id: string;
  name: string;
  x: number;
  seed: number;
  action: CharacterAction;
  actionUntil: number;
}

export const twoDimensionalMedia = new Set<VisualMedium>([
  'paper_cutout',
  'collage_zine',
  'ink_monochrome',
  'corporate_vector',
  'hand_drawn',
]);

export function usesTwoDimensionalRenderer(segment: SegmentPackage): boolean {
  return twoDimensionalMedia.has(resolveProductionDesign(segment).visualMedium);
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function colour(seed: number, saturation = 58, lightness = 54): string {
  return `hsl(${seed % 360} ${saturation}% ${lightness}%)`;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export class Broadcast2DScene implements PlayoutVisuals {
  private readonly context: CanvasRenderingContext2D;
  private segment: SegmentPackage | null = null;
  private medium: VisualMedium = 'paper_cutout';
  private characters: DrawnCharacter[] = [];
  private activeSpeaker = '';
  private activeSpeakerUntil = 0;
  private camera: CameraName = 'CAMERA_WIDE';
  private startedAt = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('Canvas 2D renderer is unavailable');
    }
    this.context = context;
    this.canvas.width = 1280;
    this.canvas.height = 720;
  }

  loadSegment(segment: SegmentPackage): void {
    this.segment = segment;
    this.medium = resolveProductionDesign(segment).visualMedium;
    this.startedAt = performance.now();
    const speakers = new Map<string, string>();
    for (const event of segment.events) {
      if (event.type === 'speech.play') {
        speakers.set(event.characterId, event.characterName);
      }
    }
    const entries = [...speakers.entries()].slice(0, 6);
    const spacing = 760 / Math.max(1, entries.length - 1);
    this.characters = entries.map(([id, name], index) => ({
      id,
      name,
      x: entries.length === 1 ? 640 : 260 + spacing * index,
      seed: stableHash(`${segment.programme.id}:${id}`),
      action: 'IDLE',
      actionUntil: 0,
    }));
    this.camera = 'CAMERA_WIDE';
    this.render();
  }

  cutCamera(camera: CameraName): void {
    this.camera = camera;
  }

  speak(characterId: string, durationMs: number): void {
    this.activeSpeaker = characterId;
    this.activeSpeakerUntil = performance.now() + durationMs;
  }

  performAction(characterId: string, action: CharacterAction): void {
    const character = this.characters.find((candidate) => candidate.id === characterId);
    if (character !== undefined) {
      character.action = action;
      character.actionUntil = performance.now() + (action === 'FREEZE' ? 2_400 : 1_400);
    }
  }

  render(): void {
    const segment = this.segment;
    if (segment === null || !twoDimensionalMedia.has(this.medium)) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const now = performance.now();
    const elapsed = (now - this.startedAt) / 1_000;
    const context = this.context;
    context.save();
    this.drawBackdrop(segment, elapsed);
    this.drawPremiseProp(segment.programme.premise.toLowerCase(), elapsed);

    const focusIndex = this.camera === 'CAMERA_HOST' ? 0 : this.camera === 'CAMERA_GUEST' ? 1 : -1;
    this.characters.forEach((character, index) => {
      const focused = focusIndex === -1 || focusIndex === index;
      context.save();
      if (focusIndex !== -1 && !focused) {
        context.globalAlpha = 0.34;
      }
      this.drawCharacter(character, now, elapsed, focused && focusIndex !== -1);
      context.restore();
    });
    this.drawMediumTexture(elapsed);
    context.restore();
  }

  private drawBackdrop(segment: SegmentPackage, elapsed: number): void {
    const context = this.context;
    const seed = stableHash(segment.channel.name);
    const base = colour(seed, this.medium === 'corporate_vector' ? 48 : 42, 32);
    context.fillStyle = this.medium === 'ink_monochrome' ? '#f1eddf' : base;
    context.fillRect(0, 0, 1280, 720);

    if (this.medium === 'paper_cutout') {
      context.fillStyle = '#d9c17f';
      context.fillRect(0, 520, 1280, 200);
      for (let index = 0; index < 7; index += 1) {
        context.fillStyle = colour(seed + index * 49, 44, 48);
        context.beginPath();
        context.moveTo(index * 210 - 80, 520);
        context.lineTo(index * 210 + 100, 180 + (index % 2) * 80);
        context.lineTo(index * 210 + 260, 520);
        context.closePath();
        context.fill();
      }
    } else if (this.medium === 'collage_zine') {
      context.fillStyle = '#f2e5c4';
      context.fillRect(0, 0, 1280, 720);
      for (let index = 0; index < 9; index += 1) {
        context.save();
        context.translate(80 + index * 145, 90 + (index % 3) * 170);
        context.rotate((((seed >>> index) % 9) - 4) * 0.06);
        context.fillStyle = colour(seed + index * 83, 72, 54);
        context.fillRect(-90, -55, 210, 115);
        context.restore();
      }
    } else if (this.medium === 'corporate_vector') {
      context.fillStyle = '#102c59';
      context.fillRect(0, 0, 1280, 720);
      context.fillStyle = '#35d9bd';
      context.beginPath();
      context.moveTo(0, 720);
      context.lineTo(570, 0);
      context.lineTo(820, 0);
      context.lineTo(250, 720);
      context.closePath();
      context.fill();
      context.globalAlpha = 0.28;
      context.fillStyle = '#f5fbff';
      context.fillRect(720 + Math.sin(elapsed * 0.3) * 25, 0, 360, 720);
      context.globalAlpha = 1;
    } else if (this.medium === 'hand_drawn') {
      context.fillStyle = '#e8dfc6';
      context.fillRect(0, 0, 1280, 720);
      context.strokeStyle = '#263139';
      context.lineWidth = 4;
      for (let index = 0; index < 14; index += 1) {
        context.beginPath();
        context.moveTo(0, 110 + index * 42 + Math.sin(elapsed * 3 + index) * 3);
        context.bezierCurveTo(380, 80 + index * 46, 820, 145 + index * 37, 1280, 100 + index * 43);
        context.stroke();
      }
    } else {
      context.fillStyle = '#171612';
      context.fillRect(0, 545, 1280, 175);
      context.strokeStyle = '#171612';
      context.lineWidth = 8;
      for (let index = 0; index < 5; index += 1) {
        context.strokeRect(70 + index * 250, 80 + (index % 2) * 35, 170, 120);
      }
    }
  }

  private drawPremiseProp(premise: string, elapsed: number): void {
    const context = this.context;
    context.save();
    context.translate(640, 370 + Math.sin(elapsed * 0.8) * 3);
    context.lineWidth = this.medium === 'ink_monochrome' ? 9 : 4;
    context.strokeStyle = '#182129';
    context.fillStyle = this.medium === 'ink_monochrome' ? '#f1eddf' : '#efc75e';

    if (/\b(?:door|entrance|threshold)\b/u.test(premise)) {
      context.fillRect(-95, -190, 190, 310);
      context.strokeRect(-95, -190, 190, 310);
      context.beginPath();
      context.arc(52, -25, 11, 0, Math.PI * 2);
      context.fillStyle = '#182129';
      context.fill();
    } else if (/\b(?:clock|time|minute|day|thursday)\b/u.test(premise)) {
      context.beginPath();
      context.arc(0, -25, 115, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(0, -25);
      context.lineTo(48, -86);
      context.moveTo(0, -25);
      context.lineTo(-28, 36);
      context.stroke();
    } else if (/\b(?:house|home|property|family)\b/u.test(premise)) {
      context.fillRect(-125, -80, 250, 190);
      context.strokeRect(-125, -80, 250, 190);
      context.beginPath();
      context.moveTo(-160, -80);
      context.lineTo(0, -220);
      context.lineTo(160, -80);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (/\b(?:cup|kettle|kitchen|ingredient)\b/u.test(premise)) {
      roundedRect(context, -85, -80, 170, 170, 28);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(92, 0, 55, -Math.PI / 2, Math.PI / 2);
      context.stroke();
    } else if (/\b(?:cloud|weather|rain|sky)\b/u.test(premise)) {
      for (const [x, y, radius] of [
        [-70, 0, 65],
        [0, -45, 85],
        [80, 0, 62],
      ] as const) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    }
    context.restore();
  }

  private drawCharacter(
    character: DrawnCharacter,
    now: number,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const speaking = character.id === this.activeSpeaker && now < this.activeSpeakerUntil;
    const acting = now < character.actionUntil;
    const jitter =
      this.medium === 'hand_drawn'
        ? Math.sin(elapsed * 19 + character.seed) * 3
        : this.medium === 'collage_zine'
          ? Math.round(Math.sin(elapsed * 7 + character.seed)) * 2
          : 0;
    const scale = closeUp ? 1.28 : 1;
    const x = closeUp ? 640 : character.x;
    const y = closeUp ? 420 : 500;
    context.save();
    context.translate(x + jitter, y);
    context.scale(scale, scale);
    if (character.action === 'REACTION_SHOCKED' && acting) {
      context.scale(1.08, 1.08);
    }
    if (character.action === 'REACTION_ANGRY' && acting) {
      context.rotate(Math.sin(elapsed * 24) * 0.025);
    }

    const ink = this.medium === 'ink_monochrome' || this.medium === 'hand_drawn';
    context.lineWidth = ink ? 8 : 4;
    context.strokeStyle = '#172027';
    context.fillStyle = ink ? '#f2eddf' : colour(character.seed, 58, 53);
    const bodyWidth = 120 + (character.seed % 55);
    roundedRect(
      context,
      -bodyWidth / 2,
      -120,
      bodyWidth,
      210,
      this.medium === 'corporate_vector' ? 3 : 24,
    );
    context.fill();
    context.stroke();

    const headShape = character.seed % 3;
    context.fillStyle = ink ? '#f2eddf' : colour(character.seed >>> 5, 38, 68);
    context.beginPath();
    if (headShape === 0) {
      context.arc(0, -190, 84, 0, Math.PI * 2);
    } else if (headShape === 1) {
      context.roundRect(-78, -272, 156, 156, 18);
    } else {
      context.moveTo(0, -292);
      context.lineTo(92, -172);
      context.lineTo(0, -112);
      context.lineTo(-92, -172);
      context.closePath();
    }
    context.fill();
    context.stroke();

    context.fillStyle = '#172027';
    const eyeCount = character.seed % 7 === 0 ? 3 : character.seed % 5 === 0 ? 1 : 2;
    for (let index = 0; index < eyeCount; index += 1) {
      const eyeX = eyeCount === 1 ? 0 : (index - (eyeCount - 1) / 2) * 42;
      context.beginPath();
      context.arc(eyeX, -205 - (eyeCount === 3 && index === 1 ? 24 : 0), 8, 0, Math.PI * 2);
      context.fill();
    }

    const mouthHeight = speaking ? 10 + Math.abs(Math.sin(elapsed * 13)) * 24 : 5;
    context.fillRect(-27, -158 - mouthHeight / 2, 54, mouthHeight);

    context.strokeStyle = ink ? '#172027' : colour(character.seed, 58, 43);
    context.lineWidth = 20;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-bodyWidth / 2 + 10, -75);
    context.lineTo(
      character.action === 'POINT_AT' && acting ? -bodyWidth - 75 : -bodyWidth / 2 - 45,
      character.action === 'POINT_AT' && acting ? -135 : 15,
    );
    context.moveTo(bodyWidth / 2 - 10, -75);
    context.lineTo(bodyWidth / 2 + 45, acting ? -10 : 15);
    context.stroke();
    context.restore();
  }

  private drawMediumTexture(elapsed: number): void {
    const context = this.context;
    if (this.medium === 'hand_drawn' || this.medium === 'ink_monochrome') {
      context.globalAlpha = this.medium === 'hand_drawn' ? 0.18 : 0.08;
      context.strokeStyle = '#172027';
      context.lineWidth = 1;
      for (let y = 8; y < 720; y += 13) {
        context.beginPath();
        context.moveTo(0, y + Math.sin(elapsed * 2 + y) * 1.5);
        context.lineTo(1280, y);
        context.stroke();
      }
      context.globalAlpha = 1;
    }
  }

  dispose(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
