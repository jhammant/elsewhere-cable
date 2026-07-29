import type { SegmentPackage } from '@elsewhere-cable/schemas';
import type { PlayoutVisuals } from './playout.js';
import { resolveProductionDesign } from './production-design.js';
import { flatVisualMedia, isFlatVisualMedium, type FlatVisualMedium } from './style-grammar.js';

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

export const twoDimensionalMedia = flatVisualMedia;

export function usesTwoDimensionalRenderer(segment: SegmentPackage): boolean {
  return isFlatVisualMedium(resolveProductionDesign(segment).visualMedium);
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
  private medium: FlatVisualMedium = 'paper_cutout';
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
    const visualMedium = resolveProductionDesign(segment).visualMedium;
    this.medium = isFlatVisualMedium(visualMedium) ? visualMedium : 'paper_cutout';
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
    if (segment === null) {
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
    } else if (this.medium === 'ink_monochrome') {
      context.fillStyle = '#171612';
      context.fillRect(0, 545, 1280, 175);
      context.strokeStyle = '#171612';
      context.lineWidth = 8;
      for (let index = 0; index < 5; index += 1) {
        context.strokeRect(70 + index * 250, 80 + (index % 2) * 35, 170, 120);
      }
    } else if (this.medium === 'pixel_broadcast') {
      context.fillStyle = '#10182f';
      context.fillRect(0, 0, 1280, 720);
      const tile = 48;
      for (let y = 0; y < 720; y += tile) {
        for (let x = 0; x < 1280; x += tile) {
          context.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#17264b' : '#1d315d';
          context.fillRect(x, y, tile, tile);
        }
      }
      context.fillStyle = '#70d7c7';
      context.fillRect(0, 520, 1280, 200);
      context.fillStyle = '#213e67';
      for (let index = 0; index < 9; index += 1) {
        context.fillRect(index * 160 - 25, 280 + (index % 3) * 48, 96, 240);
      }
    } else if (this.medium === 'archive_film') {
      context.fillStyle = '#b89a67';
      context.fillRect(0, 0, 1280, 720);
      context.fillStyle = '#2b241a';
      context.fillRect(0, 0, 1280, 58);
      context.fillRect(0, 662, 1280, 58);
      context.strokeStyle = '#51432f';
      context.lineWidth = 18;
      context.strokeRect(76, 74, 1128, 570);
      context.beginPath();
      context.arc(640, 340, 430, Math.PI, 0);
      context.stroke();
    } else if (this.medium === 'signal_corruption') {
      context.fillStyle = '#060814';
      context.fillRect(0, 0, 1280, 720);
      for (let index = 0; index < 28; index += 1) {
        const y = (index * 73 + Math.floor(elapsed * 37)) % 720;
        const width = 90 + ((seed >>> (index % 24)) % 620);
        context.fillStyle = ['#ff2e88', '#28e7d5', '#5b5cff', '#e8f5e9'][index % 4]!;
        context.globalAlpha = 0.18 + (index % 3) * 0.12;
        context.fillRect((seed + index * 193) % 1180, y, width, 8 + (index % 4) * 7);
      }
      context.globalAlpha = 1;
    } else if (this.medium === 'shadow_theatre') {
      const gradient = context.createRadialGradient(640, 330, 40, 640, 330, 700);
      gradient.addColorStop(0, '#ffeab0');
      gradient.addColorStop(0.72, '#d4a55c');
      gradient.addColorStop(1, '#4a2718');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 1280, 720);
      context.fillStyle = '#21130f';
      context.fillRect(0, 570, 1280, 150);
      for (let index = 0; index < 8; index += 1) {
        context.beginPath();
        context.moveTo(index * 190 - 80, 570);
        context.lineTo(index * 190 + 35, 310 - (index % 2) * 85);
        context.lineTo(index * 190 + 150, 570);
        context.fill();
      }
    } else if (this.medium === 'ascii_terminal') {
      context.fillStyle = '#020905';
      context.fillRect(0, 0, 1280, 720);
      context.strokeStyle = '#39f28f';
      context.lineWidth = 2;
      context.strokeRect(46, 46, 1188, 620);
      context.font = '21px monospace';
      context.fillStyle = 'rgba(88, 255, 159, 0.42)';
      for (let row = 0; row < 18; row += 1) {
        const line = `${String(row + 1).padStart(2, '0')}  ${'>'.repeat((row % 5) + 1)} SIGNAL_${String(
          (seed >>> (row % 24)) % 999,
        ).padStart(3, '0')} ${'.'.repeat(29 - (row % 7))}`;
        context.fillText(line, 72, 86 + row * 31);
      }
      context.fillStyle = '#50ffa0';
      context.fillRect(70, 545, 1140, 78);
      context.fillStyle = '#031109';
      context.fillText(`EXECUTE REALITY://${segment.channel.number}`, 92, 593);
    } else if (this.medium === 'blueprint_schematic') {
      context.fillStyle = '#0752a0';
      context.fillRect(0, 0, 1280, 720);
      context.strokeStyle = 'rgba(185, 231, 255, 0.2)';
      context.lineWidth = 1;
      for (let x = 0; x < 1280; x += 32) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 720);
        context.stroke();
      }
      for (let y = 0; y < 720; y += 32) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(1280, y);
        context.stroke();
      }
      context.strokeStyle = '#d8f4ff';
      context.lineWidth = 3;
      context.strokeRect(42, 42, 1196, 636);
      context.beginPath();
      context.arc(640, 352, 286 + Math.sin(elapsed * 0.5) * 8, 0, Math.PI * 2);
      context.moveTo(640, 66);
      context.lineTo(640, 640);
      context.moveTo(354, 352);
      context.lineTo(926, 352);
      context.stroke();
      context.font = '18px monospace';
      context.fillStyle = '#e4f8ff';
      context.fillText('FIG. 08 / NOT TO SCALE / REVISION ∞', 70, 82);
    } else if (this.medium === 'stained_glass') {
      context.fillStyle = '#100b24';
      context.fillRect(0, 0, 1280, 720);
      const glassColours = ['#ff406f', '#ffb637', '#32c7bd', '#3f73e8', '#9f52d8'];
      for (let index = 0; index < 18; index += 1) {
        const angle = (index / 18) * Math.PI * 2 + elapsed * 0.015;
        const inner = 135;
        const outer = 610;
        context.beginPath();
        context.moveTo(640 + Math.cos(angle) * inner, 340 + Math.sin(angle) * inner);
        context.lineTo(
          640 + Math.cos(angle - Math.PI / 18) * outer,
          340 + Math.sin(angle - Math.PI / 18) * outer,
        );
        context.lineTo(
          640 + Math.cos(angle + Math.PI / 18) * outer,
          340 + Math.sin(angle + Math.PI / 18) * outer,
        );
        context.closePath();
        context.fillStyle = glassColours[index % glassColours.length]!;
        context.globalAlpha = 0.67;
        context.fill();
        context.globalAlpha = 1;
        context.strokeStyle = '#1b1532';
        context.lineWidth = 12;
        context.stroke();
      }
      context.beginPath();
      context.arc(640, 340, 135, 0, Math.PI * 2);
      context.fillStyle = '#f4cf55';
      context.fill();
      context.strokeStyle = '#1b1532';
      context.lineWidth = 14;
      context.stroke();
      context.fillStyle = '#1a122d';
      context.fillRect(0, 574, 1280, 146);
    } else if (this.medium === 'xerox_punk') {
      context.fillStyle = '#efe9d5';
      context.fillRect(0, 0, 1280, 720);
      for (let index = 0; index < 12; index += 1) {
        context.save();
        context.translate(55 + (index % 6) * 220, 74 + Math.floor(index / 6) * 270);
        context.rotate(((index % 5) - 2) * 0.035);
        context.fillStyle = index % 3 === 0 ? '#fa285f' : index % 3 === 1 ? '#111111' : '#f5cc2d';
        context.fillRect(-25, -26, 196, 218);
        context.strokeStyle = '#111111';
        context.lineWidth = 8;
        context.strokeRect(-25, -26, 196, 218);
        context.restore();
      }
      context.fillStyle = '#111111';
      context.font = '900 48px sans-serif';
      context.fillText('LIVE COPY / COPY LIVES', 52, 674);
    } else if (this.medium === 'storybook_wash') {
      context.fillStyle = '#f5ecd3';
      context.fillRect(0, 0, 1280, 720);
      const wash = [
        ['#82b6c7', 590, 0.1],
        ['#9bbf83', 520, 0.18],
        ['#d99278', 450, 0.26],
      ] as const;
      for (const [fill, baseline, speed] of wash) {
        context.beginPath();
        context.moveTo(0, 720);
        context.lineTo(0, baseline);
        for (let x = 0; x <= 1280; x += 80) {
          context.lineTo(
            x,
            baseline - 110 - Math.sin(x * 0.007 + elapsed * speed) * 72 - ((x / 80) % 3) * 18,
          );
        }
        context.lineTo(1280, 720);
        context.closePath();
        context.fillStyle = fill;
        context.globalAlpha = 0.58;
        context.fill();
      }
      context.globalAlpha = 1;
      context.fillStyle = 'rgba(255, 245, 208, 0.74)';
      context.beginPath();
      context.arc(1020, 148, 94, 0, Math.PI * 2);
      context.fill();
    } else if (this.medium === 'isometric_manual') {
      context.fillStyle = '#f2efe3';
      context.fillRect(0, 0, 1280, 720);
      context.strokeStyle = 'rgba(32, 68, 84, 0.2)';
      context.lineWidth = 1;
      for (let offset = -720; offset < 1280; offset += 44) {
        context.beginPath();
        context.moveTo(offset, 720);
        context.lineTo(offset + 720, 0);
        context.stroke();
        context.beginPath();
        context.moveTo(offset + 720, 720);
        context.lineTo(offset, 0);
        context.stroke();
      }
      context.strokeStyle = '#274d5b';
      context.lineWidth = 4;
      for (let index = 0; index < 5; index += 1) {
        const x = 105 + index * 250;
        const y = 150 + (index % 2) * 92;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 92, y - 46);
        context.lineTo(x + 184, y);
        context.lineTo(x + 92, y + 46);
        context.closePath();
        context.stroke();
        context.fillStyle = '#ea4c59';
        context.font = '700 28px sans-serif';
        context.fillText(String(index + 1), x + 78, y + 10);
      }
      context.fillStyle = '#274d5b';
      context.fillRect(0, 590, 1280, 130);
      context.fillStyle = '#f2efe3';
      context.font = '700 25px sans-serif';
      context.fillText('ASSEMBLY MUST REMAIN FICTIONAL', 52, 650);
    } else {
      context.fillStyle = '#071b45';
      context.fillRect(0, 0, 1280, 720);
      context.strokeStyle = 'rgba(82, 220, 255, 0.28)';
      context.lineWidth = 2;
      for (let x = 40; x < 1280; x += 80) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 720);
        context.stroke();
      }
      for (let y = 40; y < 720; y += 80) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(1280, y);
        context.stroke();
      }
      context.fillStyle = '#102761';
      context.fillRect(0, 545, 1280, 175);
      context.strokeStyle = '#ffea64';
      context.strokeRect(34, 34, 1212, 652);
    }
  }

  private drawPremiseProp(premise: string, elapsed: number): void {
    const context = this.context;
    context.save();
    const pixel = this.medium === 'pixel_broadcast';
    const shadow = this.medium === 'shadow_theatre';
    const thermal = this.medium === 'thermal_camera';
    const signal = this.medium === 'signal_corruption';
    context.translate(
      pixel ? Math.round(640 / 16) * 16 : 640,
      pixel
        ? Math.round((370 + Math.sin(elapsed * 3) * 4) / 16) * 16
        : 370 + Math.sin(elapsed * 0.8) * 3,
    );
    context.lineWidth = this.medium === 'ink_monochrome' ? 9 : pixel ? 12 : 4;
    context.strokeStyle = shadow ? '#21130f' : thermal ? '#ffec62' : signal ? '#57ffe1' : '#182129';
    context.fillStyle =
      this.medium === 'ink_monochrome'
        ? '#f1eddf'
        : shadow
          ? '#21130f'
          : thermal
            ? '#ff3f88'
            : signal
              ? '#151b46'
              : '#efc75e';
    if (signal) {
      context.globalAlpha = 0.62 + Math.sin(elapsed * 23) * 0.18;
    }

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
    if (this.medium === 'pixel_broadcast') {
      this.drawPixelCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'shadow_theatre') {
      this.drawShadowCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'thermal_camera') {
      this.drawThermalCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'signal_corruption') {
      this.drawSignalCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'ascii_terminal') {
      this.drawAsciiCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'blueprint_schematic') {
      this.drawBlueprintCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'stained_glass') {
      this.drawStainedGlassCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'xerox_punk') {
      this.drawXeroxCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'storybook_wash') {
      this.drawStorybookCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
    if (this.medium === 'isometric_manual') {
      this.drawIsometricCharacter(character, speaking, acting, elapsed, closeUp);
      return;
    }
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
    context.beginPath();
    if (this.medium === 'paper_cutout') {
      context.moveTo(-bodyWidth / 2, 90);
      context.lineTo(-bodyWidth * 0.42, -120);
      context.lineTo(bodyWidth * 0.42, -120);
      context.lineTo(bodyWidth / 2, 90);
      context.closePath();
    } else if (this.medium === 'collage_zine') {
      context.moveTo(-bodyWidth * 0.55, 76);
      context.lineTo(-bodyWidth * 0.38, -128);
      context.lineTo(bodyWidth * 0.18, -116);
      context.lineTo(bodyWidth * 0.58, 52);
      context.lineTo(bodyWidth * 0.14, 98);
      context.closePath();
    } else {
      roundedRect(
        context,
        -bodyWidth / 2,
        -120,
        bodyWidth,
        210,
        this.medium === 'corporate_vector' ? 3 : 24,
      );
    }
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

  private drawPixelCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const scale = closeUp ? 1.45 : 1;
    const x = closeUp ? 640 : Math.round(character.x / 16) * 16;
    const y = closeUp ? 450 : 512;
    const step = Math.floor(elapsed * 6 + character.seed) % 2;
    context.save();
    context.translate(x, y + step * 5);
    context.scale(scale, scale);
    context.fillStyle = '#10182f';
    context.fillRect(-66, -260, 132, 92);
    context.fillStyle = colour(character.seed, 70, 58);
    context.fillRect(-82, -162, 164, 188);
    context.fillStyle = colour(character.seed >>> 4, 70, 72);
    context.fillRect(-58, -244, 116, 76);
    context.fillStyle = '#10182f';
    context.fillRect(-34, -220, 16, 16);
    context.fillRect(18, -220, 16, 16);
    context.fillRect(-30, -190, 60, speaking ? 24 : 8);
    const leftReach = character.action === 'POINT_AT' && acting ? -150 : -110;
    context.fillStyle = colour(character.seed, 70, 48);
    context.fillRect(leftReach, -132, Math.abs(leftReach) - 70, 24);
    context.fillRect(82, -132, 42, 24);
    context.fillRect(-64, 26, 42, 64);
    context.fillRect(22, 26, 42, 64);
    context.restore();
  }

  private drawShadowCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const scale = closeUp ? 1.3 : 1;
    const x = closeUp ? 640 : character.x;
    const sway = Math.sin(elapsed * 1.7 + character.seed) * 0.035;
    context.save();
    context.translate(x, closeUp ? 445 : 505);
    context.scale(scale, scale);
    context.rotate(sway);
    context.fillStyle = '#1c110e';
    context.strokeStyle = '#1c110e';
    context.lineWidth = 18;
    context.beginPath();
    context.arc(0, -210, 70, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(-56, -138);
    context.lineTo(-86, 80);
    context.lineTo(86, 80);
    context.lineTo(56, -138);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(-45, -104);
    context.lineTo(character.action === 'POINT_AT' && acting ? -178 : -112, acting ? -150 : 0);
    context.moveTo(45, -104);
    context.lineTo(112, 0);
    context.stroke();
    context.fillStyle = speaking ? '#ffdf88' : '#f7c96f';
    context.fillRect(-24, -190, 48, speaking ? 14 : 5);
    context.strokeStyle = 'rgba(45, 25, 15, 0.55)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, -280);
    context.lineTo(0, -620);
    context.stroke();
    context.restore();
  }

  private drawThermalCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const scale = closeUp ? 1.28 : 1;
    const x = closeUp ? 640 : character.x;
    context.save();
    context.translate(x, closeUp ? 438 : 500);
    context.scale(scale, scale);
    const pulse = 1 + Math.sin(elapsed * 2.4 + character.seed) * 0.025;
    context.scale(pulse, pulse);
    for (const [radius, fill] of [
      [105, '#4d2fff'],
      [88, '#ee2e9b'],
      [67, '#ff8b32'],
      [42, '#fff06a'],
    ] as const) {
      context.fillStyle = fill;
      context.beginPath();
      context.arc(0, -205, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#d62dab';
    roundedRect(context, -82, -118, 164, 205, 58);
    context.fill();
    context.fillStyle = '#ff9c37';
    roundedRect(context, -60, -100, 120, 172, 45);
    context.fill();
    context.strokeStyle = '#fff06a';
    context.lineWidth = 18;
    context.beginPath();
    context.moveTo(-62, -72);
    context.lineTo(character.action === 'POINT_AT' && acting ? -165 : -112, acting ? -128 : 20);
    context.moveTo(62, -72);
    context.lineTo(112, 20);
    context.stroke();
    context.fillStyle = '#251b74';
    context.fillRect(-42, -220, 18, 18);
    context.fillRect(24, -220, 18, 18);
    context.fillRect(-32, -178, 64, speaking ? 22 : 6);
    context.restore();
  }

  private drawSignalCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const scale = closeUp ? 1.3 : 1;
    const x = closeUp ? 640 : character.x;
    const glitch = Math.round(Math.sin(elapsed * 31 + character.seed) * 12);
    context.save();
    context.translate(x + glitch, closeUp ? 440 : 500);
    context.scale(scale, scale);
    const colours = ['#ff2e88', '#28e7d5', '#6b5cff'];
    for (let layer = 0; layer < 3; layer += 1) {
      context.globalAlpha = 0.48;
      context.fillStyle = colours[layer]!;
      const offset = (layer - 1) * 13;
      context.fillRect(-82 + offset, -118, 164, 208);
      context.fillRect(-68 - offset, -270, 136, 136);
    }
    context.globalAlpha = 1;
    context.fillStyle = '#eafcf7';
    for (let index = 0; index < 8; index += 1) {
      const y = -252 + index * 43;
      const width = 46 + ((character.seed >>> index) % 104);
      context.fillRect(-width / 2 + (index % 2) * glitch, y, width, 9 + (index % 3) * 5);
    }
    context.fillStyle = '#070a16';
    context.fillRect(-38, -220, 18, 18);
    context.fillRect(20, -220, 18, 18);
    context.fillRect(-34, -176, 68, speaking ? 22 : 7);
    if (acting) {
      context.fillStyle = '#ffed66';
      context.fillRect(character.action === 'POINT_AT' ? -196 : -130, -92, 112, 16);
    }
    context.restore();
  }

  private drawAsciiCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const x = closeUp ? 640 : character.x;
    const scale = closeUp ? 1.35 : 1;
    const frame = Math.floor(elapsed * 4 + character.seed) % 2;
    context.save();
    context.translate(x, closeUp ? 440 : 500);
    context.scale(scale, scale);
    context.fillStyle = 'rgba(1, 12, 6, 0.9)';
    context.strokeStyle = '#48ff9d';
    context.lineWidth = 3;
    context.strokeRect(-108, -300, 216, 374);
    context.fillStyle = '#48ff9d';
    context.font = '30px monospace';
    const head = frame === 0 ? ' /O_O\\ ' : ' |o_o| ';
    context.fillText(head, -92, -218);
    context.fillText(' /|_|\\ ', -92, -142);
    context.fillText(
      acting && character.action === 'POINT_AT' ? '<==| |  ' : '  /| |\\ ',
      -92,
      -76,
    );
    context.fillText('  / \\  ', -92, -10);
    context.font = '18px monospace';
    context.fillText(speaking ? '[TRANSMIT █]' : '[STANDBY _]', -86, 48);
    context.restore();
  }

  private drawBlueprintCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const x = closeUp ? 640 : character.x;
    const scale = closeUp ? 1.3 : 1;
    const reach = character.action === 'POINT_AT' && acting ? -175 : -112;
    context.save();
    context.translate(x, closeUp ? 444 : 505);
    context.scale(scale, scale);
    context.strokeStyle = '#e5f8ff';
    context.fillStyle = 'rgba(116, 206, 255, 0.12)';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, -214, 76, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.strokeRect(-72, -134, 144, 212);
    context.beginPath();
    context.moveTo(-58, -90);
    context.lineTo(reach, acting ? -138 : 8);
    context.moveTo(58, -90);
    context.lineTo(112, 8);
    context.moveTo(-42, 78);
    context.lineTo(-56, 132);
    context.moveTo(42, 78);
    context.lineTo(56, 132);
    context.stroke();
    context.setLineDash([8, 8]);
    context.lineWidth = 2;
    context.strokeRect(-104, -304, 208, 450);
    context.setLineDash([]);
    context.fillStyle = '#e5f8ff';
    context.font = '17px monospace';
    context.fillText(`Ø ${70 + (character.seed % 29)}.${Math.floor(elapsed) % 10}`, -104, -318);
    context.fillRect(-28, -192, 56, speaking ? 20 : 5);
    context.restore();
  }

  private drawStainedGlassCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const x = closeUp ? 640 : character.x;
    const scale = closeUp ? 1.25 : 1;
    context.save();
    context.translate(x, closeUp ? 444 : 505);
    context.scale(scale, scale);
    context.rotate(Math.sin(elapsed * 0.7 + character.seed) * 0.012);
    context.strokeStyle = '#1b1532';
    context.lineWidth = 11;
    context.fillStyle = colour(character.seed, 78, 55);
    context.beginPath();
    context.moveTo(0, -302);
    context.lineTo(82, -218);
    context.lineTo(58, -126);
    context.lineTo(96, 86);
    context.lineTo(-96, 86);
    context.lineTo(-58, -126);
    context.lineTo(-82, -218);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(-58, -126);
    context.lineTo(58, -126);
    context.moveTo(-82, -218);
    context.lineTo(82, -218);
    context.moveTo(0, -302);
    context.lineTo(0, 86);
    context.stroke();
    context.fillStyle = '#f7d75f';
    context.beginPath();
    context.arc(-28, -218, 10, 0, Math.PI * 2);
    context.arc(28, -218, 10, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#1b1532';
    context.lineWidth = speaking ? 18 : 7;
    context.beginPath();
    context.moveTo(-25, -170);
    context.lineTo(25, -170);
    context.stroke();
    if (acting) {
      context.strokeStyle = '#f7d75f';
      context.lineWidth = 16;
      context.beginPath();
      context.moveTo(-72, -80);
      context.lineTo(character.action === 'POINT_AT' ? -188 : -130, -118);
      context.stroke();
    }
    context.restore();
  }

  private drawXeroxCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const x = closeUp ? 640 : character.x;
    const scale = closeUp ? 1.28 : 1;
    const jump = Math.round(Math.sin(elapsed * 7 + character.seed)) * 3;
    context.save();
    context.translate(x + jump, closeUp ? 442 : 503);
    context.scale(scale, scale);
    for (let copy = 1; copy >= 0; copy -= 1) {
      context.save();
      context.translate(copy * 11, -copy * 7);
      context.fillStyle = copy === 1 ? '#f22961' : '#0b0b0b';
      context.beginPath();
      context.arc(0, -210, 76, 0, Math.PI * 2);
      context.fill();
      context.fillRect(-76, -132, 152, 218);
      context.restore();
    }
    context.fillStyle = '#efe9d5';
    context.fillRect(-42, -234, 22, 16);
    context.fillRect(20, -234, 22, 16);
    context.fillRect(-36, -188, 72, speaking ? 24 : 7);
    context.fillStyle = '#f5cc2d';
    context.save();
    context.rotate(-0.08);
    context.fillRect(-92, -112, 184, 34);
    context.fillStyle = '#111111';
    context.font = '900 18px sans-serif';
    context.fillText(acting ? 'DO IT AGAIN' : 'ORIGINAL COPY', -82, -88);
    context.restore();
    context.restore();
  }

  private drawStorybookCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const x = closeUp ? 640 : character.x;
    const scale = closeUp ? 1.25 : 1;
    context.save();
    context.translate(x, closeUp ? 444 : 505);
    context.scale(scale, scale);
    context.rotate(Math.sin(elapsed * 0.6 + character.seed) * 0.018);
    context.globalAlpha = 0.84;
    context.fillStyle = colour(character.seed, 38, 58);
    context.strokeStyle = '#3d3a34';
    context.lineWidth = 4;
    context.beginPath();
    context.ellipse(0, -202, 72, 91, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(-62, -122);
    context.quadraticCurveTo(-102, 8, -64, 88);
    context.quadraticCurveTo(0, 112, 64, 88);
    context.quadraticCurveTo(102, 8, 62, -122);
    context.closePath();
    context.fillStyle = colour(character.seed >>> 4, 42, 61);
    context.fill();
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = '#3d3a34';
    context.beginPath();
    context.arc(-25, -217, 7, 0, Math.PI * 2);
    context.arc(25, -217, 7, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = speaking ? 13 : 4;
    context.beginPath();
    context.moveTo(-22, -172);
    context.quadraticCurveTo(0, -158, 22, -172);
    context.stroke();
    if (acting) {
      context.lineWidth = 12;
      context.beginPath();
      context.moveTo(-55, -82);
      context.quadraticCurveTo(-118, -124, character.action === 'POINT_AT' ? -176 : -128, -62);
      context.stroke();
    }
    context.restore();
  }

  private drawIsometricCharacter(
    character: DrawnCharacter,
    speaking: boolean,
    acting: boolean,
    _elapsed: number,
    closeUp: boolean,
  ): void {
    const context = this.context;
    const x = closeUp ? 640 : character.x;
    const scale = closeUp ? 1.3 : 1;
    const explode = acting ? 16 : 6;
    context.save();
    context.translate(x, closeUp ? 446 : 506);
    context.scale(scale, scale);
    context.strokeStyle = '#274d5b';
    context.lineWidth = 5;
    const parts = [
      { y: -254 - explode, width: 120, height: 82, fill: '#f3b743' },
      { y: -122, width: 154, height: 148, fill: '#ea4c59' },
      { y: 56 + explode, width: 132, height: 54, fill: '#62aaa4' },
    ];
    for (const part of parts) {
      context.fillStyle = part.fill;
      context.beginPath();
      context.moveTo(0, part.y - part.height / 2);
      context.lineTo(part.width / 2, part.y - part.height / 4);
      context.lineTo(part.width / 2, part.y + part.height / 3);
      context.lineTo(0, part.y + part.height / 2);
      context.lineTo(-part.width / 2, part.y + part.height / 3);
      context.lineTo(-part.width / 2, part.y - part.height / 4);
      context.closePath();
      context.fill();
      context.stroke();
    }
    context.fillStyle = '#274d5b';
    context.fillRect(-34, -272 - explode, 16, 16);
    context.fillRect(18, -272 - explode, 16, 16);
    context.fillRect(-31, -232 - explode, 62, speaking ? 20 : 6);
    context.setLineDash([7, 7]);
    context.beginPath();
    context.moveTo(0, -174 - explode);
    context.lineTo(0, -122);
    context.moveTo(0, 26);
    context.lineTo(0, 56 + explode);
    context.stroke();
    context.setLineDash([]);
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
    } else if (this.medium === 'pixel_broadcast') {
      context.globalAlpha = 0.2;
      context.fillStyle = '#071020';
      for (let y = 0; y < 720; y += 8) {
        context.fillRect(0, y, 1280, 3);
      }
      context.globalAlpha = 1;
    } else if (this.medium === 'archive_film') {
      context.globalAlpha = 0.22;
      context.fillStyle = '#fff4cb';
      for (let index = 0; index < 24; index += 1) {
        const x = (index * 193 + Math.floor(elapsed * 71)) % 1280;
        const y = (index * 97 + Math.floor(elapsed * 29)) % 720;
        context.fillRect(x, y, 2 + (index % 3), 2 + (index % 4));
      }
      context.strokeStyle = '#30281d';
      for (let index = 0; index < 4; index += 1) {
        const x = (index * 337 + Math.floor(elapsed * 53)) % 1280;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + Math.sin(elapsed + index) * 8, 720);
        context.stroke();
      }
      context.globalAlpha = 1;
    } else if (this.medium === 'signal_corruption') {
      context.globalAlpha = 0.25;
      for (let index = 0; index < 10; index += 1) {
        context.fillStyle = index % 2 === 0 ? '#57ffe1' : '#ff2e88';
        const y = (index * 83 + Math.floor(elapsed * 173)) % 720;
        context.fillRect(0, y, 1280, 3 + (index % 4));
      }
      context.globalAlpha = 1;
    } else if (this.medium === 'shadow_theatre') {
      context.globalAlpha = 0.08;
      context.fillStyle = '#4e2c18';
      for (let index = 0; index < 180; index += 1) {
        const x = (index * 73) % 1280;
        const y = (index * 131) % 720;
        context.fillRect(x, y, 2, 2);
      }
      context.globalAlpha = 1;
    } else if (this.medium === 'thermal_camera') {
      context.strokeStyle = 'rgba(255, 238, 96, 0.58)';
      context.lineWidth = 2;
      context.strokeRect(90, 70, 1100, 570);
      context.beginPath();
      context.moveTo(590, 355);
      context.lineTo(690, 355);
      context.moveTo(640, 305);
      context.lineTo(640, 405);
      context.stroke();
      context.fillStyle = '#ffea64';
      context.font = '24px monospace';
      context.fillText(
        `THERMAL ${String(31 + (Math.floor(elapsed) % 9)).padStart(2, '0')}.7C`,
        94,
        58,
      );
    } else if (this.medium === 'ascii_terminal') {
      context.globalAlpha = 0.18;
      context.fillStyle = '#4cff9b';
      for (let y = 0; y < 720; y += 6) {
        context.fillRect(0, y, 1280, 1);
      }
      context.globalAlpha = 1;
      context.fillRect(72 + (Math.floor(elapsed * 7) % 74) * 14, 632, 12, 24);
    } else if (this.medium === 'blueprint_schematic') {
      context.strokeStyle = 'rgba(229, 248, 255, 0.64)';
      context.lineWidth = 2;
      context.setLineDash([6, 9]);
      context.beginPath();
      context.moveTo(70, 620);
      context.lineTo(1210, 620);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#e5f8ff';
      context.font = '16px monospace';
      context.fillText(`SECTION ${String(Math.floor(elapsed) % 99).padStart(2, '0')}`, 1070, 650);
    } else if (this.medium === 'stained_glass') {
      const shimmer = 0.08 + Math.sin(elapsed * 0.8) * 0.03;
      context.globalAlpha = shimmer;
      context.fillStyle = '#fffbe0';
      context.beginPath();
      context.arc(640, 340, 340, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    } else if (this.medium === 'xerox_punk') {
      context.globalAlpha = 0.18;
      context.fillStyle = '#111111';
      for (let index = 0; index < 520; index += 1) {
        const x = (index * 97 + Math.floor(elapsed * 19)) % 1280;
        const y = (index * 53 + ((index * 7_919) % 719)) % 720;
        context.fillRect(x, y, 1 + (index % 4), 1 + (index % 3));
      }
      context.globalAlpha = 1;
    } else if (this.medium === 'storybook_wash') {
      context.globalAlpha = 0.055;
      for (let index = 0; index < 15; index += 1) {
        context.fillStyle = colour(index * 79, 45, 56);
        context.beginPath();
        context.arc(
          (index * 173) % 1280,
          (index * 109) % 720,
          70 + (index % 5) * 24,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.globalAlpha = 1;
    } else if (this.medium === 'isometric_manual') {
      context.strokeStyle = '#ea4c59';
      context.lineWidth = 3;
      for (const [x, y] of [
        [28, 28],
        [1252, 28],
        [28, 692],
        [1252, 692],
      ] as const) {
        context.beginPath();
        context.arc(x, y, 12, 0, Math.PI * 2);
        context.moveTo(x - 20, y);
        context.lineTo(x + 20, y);
        context.moveTo(x, y - 20);
        context.lineTo(x, y + 20);
        context.stroke();
      }
    }
  }

  dispose(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
