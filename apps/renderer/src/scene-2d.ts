import type { SegmentPackage } from '@elsewhere-cable/schemas';
import type { PlayoutVisuals } from './playout.js';
import {
  directedCamera,
  directionTreatment,
  resolveDirectionProfile,
  type DirectionProfile,
} from './direction-profile.js';
import { pacingMotionFrame, type PacingMode, type PacingMotionFrame } from './motion-grammar.js';
import { resolveProductionDesign, type CastArchetype } from './production-design.js';
import { flatVisualMedia, isFlatVisualMedium, type FlatVisualMedium } from './style-grammar.js';

type CameraName = 'CAMERA_WIDE' | 'CAMERA_HOST' | 'CAMERA_GUEST';
type CharacterAction = Parameters<PlayoutVisuals['performAction']>[1];
type StructuralCastArchetype = Exclude<CastArchetype, 'mixed'>;
type CharacterSilhouette =
  'person' | 'faceted_alien' | 'household_object' | 'celestial_body' | 'jointed_puppet';

export type PremisePropKind =
  | 'bin'
  | 'chair'
  | 'clock'
  | 'cloud'
  | 'cup'
  | 'door'
  | 'fish'
  | 'fridge'
  | 'house'
  | 'key'
  | 'lamp'
  | 'letter'
  | 'phone'
  | 'staircase'
  | 'umbrella'
  | 'none';

interface DrawnCharacter {
  id: string;
  name: string;
  x: number;
  index: number;
  seed: number;
  design: Character2DDesign;
  action: CharacterAction;
  actionUntil: number;
}

export type TwoDimensionalComposition =
  | 'wide_tableau'
  | 'split_screen'
  | 'asymmetric_depth'
  | 'vertical_duet'
  | 'panel_grid'
  | 'orbit_diagram';

export interface TwoDimensionalPlacement {
  x: number;
  baselineOffset: number;
  scale: number;
}

export interface TwoDimensionalStageComposition {
  mode: TwoDimensionalComposition;
  placements: TwoDimensionalPlacement[];
}

export interface Character2DDesign {
  archetype: StructuralCastArchetype;
  silhouette: CharacterSilhouette;
  scaleX: number;
  scaleY: number;
  baselineOffset: number;
  headScale: number;
  bodyScale: number;
  eyeCount: number;
  variant: number;
  fingerprint: string;
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

export function resolve2DStageComposition(
  segment: SegmentPackage,
  castCount: number,
): TwoDimensionalStageComposition {
  const count = Math.max(1, Math.min(6, castCount));
  const fullFrame = ['news', 'shopping', 'advert', 'sitcom', 'ident', 'emergency'].includes(
    segment.programme.format,
  );
  const left = fullFrame ? 145 : 120;
  const right = fullFrame ? 1_135 : 815;
  const centre = (left + right) / 2;
  const width = right - left;
  const hash = stableHash(`${segment.channel.id}:${segment.programme.id}:composition`);

  if (count === 1) {
    const singleModes: TwoDimensionalComposition[] = [
      'wide_tableau',
      'asymmetric_depth',
      'orbit_diagram',
    ];
    const mode = singleModes[hash % singleModes.length]!;
    return {
      mode,
      placements: [
        mode === 'wide_tableau'
          ? { x: centre, baselineOffset: 10, scale: 1.12 }
          : mode === 'asymmetric_depth'
            ? {
                x: hash % 2 === 0 ? left + width * 0.2 : right - width * 0.2,
                baselineOffset: 42,
                scale: 1.34,
              }
            : { x: centre, baselineOffset: -42, scale: 0.78 },
      ],
    };
  }

  if (count === 2) {
    const duetModes: TwoDimensionalComposition[] = [
      'wide_tableau',
      'split_screen',
      'asymmetric_depth',
      'vertical_duet',
      'orbit_diagram',
    ];
    const mode = duetModes[hash % duetModes.length]!;
    if (mode === 'split_screen') {
      return {
        mode,
        placements: [
          { x: left + width * 0.22, baselineOffset: 18, scale: 1.08 },
          { x: right - width * 0.22, baselineOffset: 18, scale: 1.08 },
        ],
      };
    }
    if (mode === 'asymmetric_depth') {
      const largeOnLeft = hash % 2 === 0;
      return {
        mode,
        placements: [
          {
            x: largeOnLeft ? left + width * 0.16 : right - width * 0.2,
            baselineOffset: 48,
            scale: 1.28,
          },
          {
            x: largeOnLeft ? right - width * 0.17 : left + width * 0.2,
            baselineOffset: -116,
            scale: 0.62,
          },
        ],
      };
    }
    if (mode === 'vertical_duet') {
      return {
        mode,
        placements: [
          { x: centre - width * 0.17, baselineOffset: -132, scale: 0.68 },
          { x: centre + width * 0.16, baselineOffset: 58, scale: 1.18 },
        ],
      };
    }
    if (mode === 'orbit_diagram') {
      return {
        mode,
        placements: [
          { x: left + width * 0.2, baselineOffset: -64, scale: 0.76 },
          { x: right - width * 0.2, baselineOffset: 52, scale: 1.06 },
        ],
      };
    }
    return {
      mode,
      placements: [
        { x: left + width * 0.12, baselineOffset: 0, scale: 0.96 },
        { x: right - width * 0.12, baselineOffset: 0, scale: 0.96 },
      ],
    };
  }

  const ensembleModes: TwoDimensionalComposition[] = [
    'panel_grid',
    'orbit_diagram',
    'wide_tableau',
    'asymmetric_depth',
  ];
  const mode = ensembleModes[hash % ensembleModes.length]!;
  const placements = Array.from({ length: count }, (_, index) => {
    if (mode === 'panel_grid') {
      const columns = count > 4 ? 3 : 2;
      const row = Math.floor(index / columns);
      const column = index % columns;
      return {
        x: left + (width * (column + 0.5)) / columns,
        baselineOffset: -112 + row * 144,
        scale: count > 4 ? 0.55 : 0.68,
      };
    }
    if (mode === 'orbit_diagram') {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      return {
        x: centre + Math.cos(angle) * width * 0.36,
        baselineOffset: Math.sin(angle) * 112 - 28,
        scale: 0.58 + ((Math.sin(angle) + 1) / 2) * 0.24,
      };
    }
    if (mode === 'asymmetric_depth') {
      return index === 0
        ? { x: left + width * 0.14, baselineOffset: 52, scale: 1.12 }
        : {
            x: left + width * (0.4 + ((index - 1) / Math.max(1, count - 2)) * 0.52),
            baselineOffset: -92 + (index % 2) * 36,
            scale: 0.5,
          };
    }
    return {
      x: left + (width * index) / Math.max(1, count - 1),
      baselineOffset: index % 2 === 0 ? 10 : -34,
      scale: count >= 5 ? 0.58 : 0.72,
    };
  });
  return { mode, placements };
}

export function premisePropKind(premise: string): PremisePropKind {
  const normalised = premise.toLowerCase();
  const candidates: Array<readonly [PremisePropKind, RegExp]> = [
    ['fridge', /\b(?:freezer|fridge|refrigerator)\b/u],
    ['umbrella', /\bumbrella\b/u],
    ['fish', /\b(?:fish|trout|salmon)\b/u],
    ['letter', /\b(?:envelope|letter|mail|postcard|receipt|ticket)\b/u],
    ['bin', /\b(?:bin|rubbish|trash)\b/u],
    ['staircase', /\b(?:staircase|stairs?|steps?)\b/u],
    ['phone', /\b(?:phone|telephone|handset)\b/u],
    ['chair', /\b(?:chair|seat|stool)\b/u],
    ['key', /\b(?:keyboard|keycap|key)\b/u],
    ['lamp', /\b(?:lamp|light|spotlight)\b/u],
    ['door', /\b(?:door|doorbell|entrance|threshold)\b/u],
    ['clock', /\b(?:clock|time|minute|day|thursday)\b/u],
    ['house', /\b(?:house|home|property|family)\b/u],
    ['cup', /\b(?:cup|kettle|kitchen|ingredient|mug)\b/u],
    ['cloud', /\b(?:cloud|weather|rain|sky|sun|moon)\b/u],
  ];
  return candidates.find(([, pattern]) => pattern.test(normalised))?.[0] ?? 'none';
}

const structuralCastArchetypes: StructuralCastArchetype[] = [
  'humanoid',
  'geometric_aliens',
  'talking_objects',
  'celestial',
  'paper_puppets',
];

export function resolve2DCharacterDesign(
  castArchetype: CastArchetype,
  seed: number,
  index: number,
): Character2DDesign {
  const archetype =
    castArchetype === 'mixed'
      ? structuralCastArchetypes[(seed + index * 3) % structuralCastArchetypes.length]!
      : castArchetype;
  const variant = (seed + index * 11) % 7;
  const variation = ((seed >>> 7) % 19) / 100;

  const base =
    archetype === 'geometric_aliens'
      ? {
          silhouette: 'faceted_alien' as const,
          scaleX: 0.76 + variation,
          scaleY: 1.07 + variation,
          baselineOffset: -8 - variant * 2,
          headScale: 1.28 + variation,
          bodyScale: 0.7 + variation,
          eyeCount: 1 + (variant % 4),
        }
      : archetype === 'talking_objects'
        ? {
            silhouette: 'household_object' as const,
            scaleX: 1.02 + variation,
            scaleY: 0.78 + variation,
            baselineOffset: 22 + (variant % 3) * 9,
            headScale: 0,
            bodyScale: 1.18 + variation,
            eyeCount: 2,
          }
        : archetype === 'celestial'
          ? {
              silhouette: 'celestial_body' as const,
              scaleX: 1.12 + variation,
              scaleY: 1.12 + variation,
              baselineOffset: -40 - (variant % 3) * 16,
              headScale: 1.5 + variation,
              bodyScale: 0.48 + variation,
              eyeCount: variant % 5 === 0 ? 1 : 2,
            }
          : archetype === 'paper_puppets'
            ? {
                silhouette: 'jointed_puppet' as const,
                scaleX: 0.68 + variation,
                scaleY: 1.04 + variation,
                baselineOffset: -2,
                headScale: 0.88 + variation,
                bodyScale: 0.72 + variation,
                eyeCount: 2,
              }
            : {
                silhouette: 'person' as const,
                scaleX: 0.88 + variation,
                scaleY: 0.9 + variation,
                baselineOffset: (variant % 3) * 8,
                headScale: 0.92 + variation,
                bodyScale: 0.9 + variation,
                eyeCount: 2,
              };

  return {
    archetype,
    ...base,
    variant,
    fingerprint: [
      archetype,
      base.silhouette,
      variant,
      base.eyeCount,
      base.scaleX.toFixed(2),
      base.scaleY.toFixed(2),
    ].join(':'),
  };
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
  private context: CanvasRenderingContext2D;
  private readonly staticCanvas: HTMLCanvasElement;
  private readonly staticContext: CanvasRenderingContext2D;
  private segment: SegmentPackage | null = null;
  private medium: FlatVisualMedium = 'paper_cutout';
  private castArchetype: CastArchetype = 'mixed';
  private characters: DrawnCharacter[] = [];
  private activeSpeaker = '';
  private activeSpeakerUntil = 0;
  private camera: CameraName = 'CAMERA_WIDE';
  private composition: TwoDimensionalComposition = 'wide_tableau';
  private pacing: PacingMode = 'conversational';
  private direction: DirectionProfile = 'formal_symmetry';
  private motionSeed = 0;
  private startedAt = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('Canvas 2D renderer is unavailable');
    }
    this.context = context;
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.staticCanvas = document.createElement('canvas');
    this.staticCanvas.width = 1280;
    this.staticCanvas.height = 720;
    const staticContext = this.staticCanvas.getContext('2d');
    if (staticContext === null) {
      throw new Error('Canvas 2D static renderer is unavailable');
    }
    this.staticContext = staticContext;
  }

  loadSegment(segment: SegmentPackage): void {
    this.segment = segment;
    const productionDesign = resolveProductionDesign(segment);
    const visualMedium = productionDesign.visualMedium;
    this.medium = isFlatVisualMedium(visualMedium) ? visualMedium : 'paper_cutout';
    this.castArchetype = productionDesign.castArchetype;
    this.pacing = segment.pacing ?? 'conversational';
    this.direction = resolveDirectionProfile({
      ...segment,
      visualMedium: productionDesign.visualMedium,
    });
    this.motionSeed =
      (stableHash(`${segment.channel.id}:${segment.programme.id}:motion`) % 10_000) / 10_000;
    this.startedAt = performance.now();
    const speakers = new Map<string, string>();
    for (const event of segment.events) {
      if (event.type === 'speech.play') {
        speakers.set(event.characterId, event.characterName);
      }
    }
    const entries = [...speakers.entries()].slice(0, 6);
    const stageComposition = resolve2DStageComposition(segment, entries.length);
    this.composition = stageComposition.mode;
    this.characters = entries.map(([id, name], index) => {
      const placement = stageComposition.placements[index]!;
      const design = resolve2DCharacterDesign(
        productionDesign.castArchetype,
        stableHash(`${segment.programme.id}:${id}`),
        index,
      );
      const directionScale =
        this.direction === 'tiny_stage'
          ? 0.56
          : this.direction === 'surveillance'
            ? 0.74
            : this.direction === 'product_macro'
              ? 1.08
              : 1;
      return {
        id,
        name,
        x: placement.x + (((stableHash(`${segment.segmentId}:${id}:layout`) >>> 4) % 21) - 10),
        index,
        seed: stableHash(`${segment.programme.id}:${id}`),
        design: {
          ...design,
          baselineOffset: design.baselineOffset + placement.baselineOffset,
          scaleX: design.scaleX * placement.scale * directionScale,
          scaleY: design.scaleY * placement.scale * directionScale,
        },
        action: 'IDLE' as const,
        actionUntil: 0,
      };
    });
    this.camera = 'CAMERA_WIDE';
    this.cacheStaticScene(segment);
    this.render();
  }

  cutCamera(camera: CameraName): void {
    this.camera = directedCamera(this.direction, camera);
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
    const motion = pacingMotionFrame(this.pacing, elapsed, this.motionSeed);
    const treatment = directionTreatment(this.direction, this.camera, elapsed, this.motionSeed);
    const context = this.context;
    const focusIndex = this.camera === 'CAMERA_HOST' ? 0 : this.camera === 'CAMERA_GUEST' ? 1 : -1;
    const focusCharacter = focusIndex < 0 ? undefined : this.characters[focusIndex];
    const stageCentre = this.stageCentre();
    const focusX = focusCharacter?.x ?? stageCentre;
    const cameraScale = Math.max(1, treatment.zoom);
    context.save();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.translate(
      stageCentre + motion.cameraX + treatment.drift * 34,
      360 + motion.cameraY + treatment.drift * 6,
    );
    context.rotate(treatment.roll);
    context.scale(motion.zoom * cameraScale, motion.zoom * cameraScale);
    context.translate(-focusX, -360);
    context.drawImage(this.staticCanvas, 0, 0);
    this.drawCompositionFrame(elapsed);
    this.drawPremiseProp(segment.programme.premise.toLowerCase(), elapsed, motion);

    this.characters.forEach((character, index) => {
      const focused = focusIndex === -1 || focusIndex === index;
      context.save();
      const speaking = character.id === this.activeSpeaker && now < this.activeSpeakerUntil;
      const phase = elapsed * 1.7 + (character.seed % 360);
      context.translate(
        Math.sin(phase) * motion.actorSway * (speaking ? 1.25 : 0.65),
        motion.actorBob * (speaking ? 1.35 : 0.55),
      );
      if (focusIndex !== -1 && !focused) {
        context.globalAlpha = 0.34;
      }
      this.drawCharacter(character, now, elapsed, focused && focusIndex !== -1);
      context.restore();
    });
    this.drawPacingGraphic(motion, elapsed);
    this.drawMediumTexture(elapsed);
    context.restore();
    this.drawDirectionOverlay(elapsed);
  }

  private drawDirectionOverlay(elapsed: number): void {
    const context = this.context;
    context.save();
    if (this.direction === 'surveillance') {
      context.strokeStyle = 'rgba(182, 255, 224, 0.68)';
      context.fillStyle = 'rgba(182, 255, 224, 0.86)';
      context.lineWidth = 2;
      context.font = '18px monospace';
      context.fillText(`REC ${String(Math.floor(elapsed)).padStart(4, '0')}`, 58, 74);
      context.strokeRect(48, 48, 1_184, 624);
      context.beginPath();
      context.moveTo(640, 48);
      context.lineTo(640, 672);
      context.moveTo(48, 360);
      context.lineTo(1_232, 360);
      context.stroke();
    } else if (this.direction === 'product_macro') {
      const pulse = 1 + Math.max(0, Math.sin(elapsed * 4)) * 0.08;
      context.translate(1_068, 132);
      context.scale(pulse, pulse);
      context.rotate(-0.09);
      context.fillStyle = '#ffe34e';
      context.strokeStyle = '#161019';
      context.lineWidth = 6;
      context.beginPath();
      for (let index = 0; index < 24; index += 1) {
        const radius = index % 2 === 0 ? 92 : 70;
        const angle = (index / 24) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = '#161019';
      context.textAlign = 'center';
      context.font = '900 21px sans-serif';
      context.fillText('LIVE', 0, 7);
    } else if (this.direction === 'rostrum_pan') {
      context.strokeStyle = 'rgba(248, 239, 205, 0.72)';
      context.lineWidth = 3;
      const crop = 34;
      for (const [x, y, horizontal, vertical] of [
        [48, 48, 1, 1],
        [1_232, 48, -1, 1],
        [48, 672, 1, -1],
        [1_232, 672, -1, -1],
      ] as const) {
        context.beginPath();
        context.moveTo(x, y + vertical * crop);
        context.lineTo(x, y);
        context.lineTo(x + horizontal * crop, y);
        context.stroke();
      }
    } else if (this.direction === 'tiny_stage') {
      context.fillStyle = 'rgba(4, 4, 7, 0.78)';
      context.fillRect(0, 0, 1_280, 82);
      context.fillRect(0, 638, 1_280, 82);
      context.strokeStyle = 'rgba(255, 224, 160, 0.5)';
      context.lineWidth = 3;
      context.strokeRect(132, 96, 1_016, 524);
    } else if (this.direction === 'handheld') {
      context.fillStyle = 'rgba(255, 63, 81, 0.84)';
      context.beginPath();
      context.arc(70, 66, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.84)';
      context.font = '16px monospace';
      context.fillText('CAM A', 88, 72);
    } else if (this.direction === 'crash_zoom') {
      context.strokeStyle = `rgba(255, 255, 255, ${
        0.08 + Math.max(0, Math.sin(elapsed * 6)) * 0.12
      })`;
      context.lineWidth = 12;
      context.strokeRect(18, 18, 1_244, 684);
    }
    context.restore();
  }

  private cacheStaticScene(segment: SegmentPackage): void {
    const displayContext = this.context;
    this.context = this.staticContext;
    try {
      this.staticContext.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);
      this.drawBackdrop(segment, 0);
      this.drawSetDressing(segment, 0);
    } finally {
      this.context = displayContext;
    }
  }

  private usesFullFrame(segment: SegmentPackage): boolean {
    return ['news', 'shopping', 'advert', 'sitcom', 'ident', 'emergency'].includes(
      segment.programme.format,
    );
  }

  private stageCentre(): number {
    return this.segment !== null && this.usesFullFrame(this.segment) ? 640 : 465;
  }

  private drawCompositionFrame(elapsed: number): void {
    const context = this.context;
    const centre = this.stageCentre();
    const fullFrame = this.segment !== null && this.usesFullFrame(this.segment);
    const left = fullFrame ? 72 : 52;
    const right = fullFrame ? 1_208 : 880;
    context.save();
    if (this.composition === 'split_screen') {
      context.fillStyle = 'rgba(5, 9, 17, 0.16)';
      context.fillRect(left, 62, centre - left - 14, 530);
      context.fillRect(centre + 14, 62, right - centre - 14, 530);
      context.strokeStyle = 'rgba(245, 239, 189, 0.72)';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(centre, 52);
      context.lineTo(centre, 610);
      context.stroke();
    } else if (this.composition === 'vertical_duet') {
      context.fillStyle = 'rgba(5, 9, 17, 0.14)';
      context.fillRect(left, 50, right - left, 235);
      context.fillStyle = 'rgba(245, 239, 189, 0.11)';
      context.fillRect(left, 306, right - left, 304);
      context.strokeStyle = 'rgba(245, 239, 189, 0.66)';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(left, 295);
      context.lineTo(right, 295);
      context.stroke();
    } else if (this.composition === 'panel_grid') {
      context.strokeStyle = 'rgba(245, 239, 189, 0.56)';
      context.lineWidth = 4;
      const columns = this.characters.length > 4 ? 3 : 2;
      const rows = Math.ceil(this.characters.length / columns);
      const width = (right - left) / columns;
      const height = 540 / rows;
      for (let index = 0; index < this.characters.length; index += 1) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        context.strokeRect(left + column * width + 8, 58 + row * height, width - 16, height - 12);
      }
    } else if (this.composition === 'orbit_diagram') {
      context.strokeStyle = 'rgba(245, 239, 189, 0.54)';
      context.lineWidth = 3;
      context.setLineDash([14, 12]);
      context.beginPath();
      context.ellipse(centre, 340, (right - left) * 0.35, 205, elapsed * 0.006, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      for (let index = 0; index < 6; index += 1) {
        const angle = elapsed * 0.08 + (index / 6) * Math.PI * 2;
        context.fillStyle = 'rgba(245, 239, 189, 0.66)';
        context.beginPath();
        context.arc(
          centre + Math.cos(angle) * (right - left) * 0.35,
          340 + Math.sin(angle) * 205,
          5,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    } else if (this.composition === 'asymmetric_depth') {
      context.strokeStyle = 'rgba(245, 239, 189, 0.54)';
      context.lineWidth = 4;
      context.strokeRect(left + 16, 66, (right - left) * 0.42, 528);
      context.strokeRect(centre + 80, 108, Math.max(180, right - centre - 112), 264);
    }
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

  private drawSetDressing(segment: SegmentPackage, elapsed: number): void {
    const context = this.context;
    const premise = segment.programme.premise.toLowerCase();
    const seed = stableHash(`${segment.channel.id}:${segment.programme.id}:set`);
    const centre = this.stageCentre();
    const stageWidth = this.usesFullFrame(segment) ? 1_040 : 760;
    const left = centre - stageWidth / 2;
    const right = centre + stageWidth / 2;
    const pixel = this.medium === 'pixel_broadcast';
    const unit = pixel ? 16 : 1;
    const snap = (value: number): number => (pixel ? Math.round(value / unit) * unit : value);

    context.save();
    context.globalAlpha =
      this.medium === 'shadow_theatre' ? 0.88 : this.medium === 'archive_film' ? 0.52 : 0.72;
    context.strokeStyle =
      this.medium === 'ink_monochrome'
        ? '#171612'
        : this.medium === 'shadow_theatre'
          ? '#21130f'
          : this.medium === 'blueprint_schematic'
            ? '#d8f4ff'
            : colour(seed >>> 4, 42, 25);
    context.fillStyle =
      this.medium === 'shadow_theatre'
        ? '#21130f'
        : this.medium === 'ink_monochrome'
          ? '#d9d2bf'
          : colour(seed, 44, 46);
    context.lineWidth = pixel ? 8 : this.medium === 'ink_monochrome' ? 7 : 4;

    if (/\b(?:cook|kitchen|recipe|ingredient|meal|food|restaurant)\b/u.test(premise)) {
      context.fillRect(snap(left + 20), 430, snap(stageWidth - 40), 110);
      context.strokeRect(snap(left + 20), 430, snap(stageWidth - 40), 110);
      for (let index = 0; index < 4; index += 1) {
        const x = snap(left + 85 + index * (stageWidth / 4));
        context.beginPath();
        context.arc(x, 420 - (index % 2) * 22, 35 + (index % 3) * 8, Math.PI, 0);
        context.fill();
        context.stroke();
        context.strokeRect(x - 3, 184 + (index % 2) * 30, 6, 155);
      }
      context.fillStyle = colour(seed + 87, 64, 62);
      for (let index = 0; index < 6; index += 1) {
        context.fillRect(snap(left + 32 + index * 58), 390 - (index % 3) * 20, 34, 40);
      }
    } else if (/\b(?:sand|desert|dune|dust|oasis)\b/u.test(premise)) {
      for (let index = 0; index < 4; index += 1) {
        context.beginPath();
        context.ellipse(
          snap(left + 100 + index * (stageWidth / 3.6)),
          468 - (index % 2) * 42,
          180,
          78,
          -0.12 + index * 0.08,
          Math.PI,
          0,
        );
        context.fill();
      }
      context.fillRect(snap(left + 42), 338, 20, 128);
      context.fillRect(snap(left + 16), 370, 74, 17);
      context.fillStyle = colour(seed + 109, 68, 65);
      context.beginPath();
      context.arc(snap(right - 100), 130, 62, 0, Math.PI * 2);
      context.fill();
    } else if (
      /\b(?:news|report|headline|election|forecast|weather|bulletin)\b/u.test(premise) ||
      segment.programme.format === 'news'
    ) {
      for (let index = 0; index < 3; index += 1) {
        const x = snap(left + 34 + index * (stageWidth / 3));
        context.fillRect(x, 96 + (index % 2) * 30, snap(stageWidth / 3 - 48), 132);
        context.strokeRect(x, 96 + (index % 2) * 30, snap(stageWidth / 3 - 48), 132);
        context.fillStyle = colour(seed + index * 111, 58, 60);
        context.fillRect(x + 18, 122 + (index % 2) * 30, snap(stageWidth / 3 - 84), 18);
        context.fillRect(x + 18, 158 + (index % 2) * 30, snap(stageWidth / 5), 42);
        context.fillStyle = colour(seed, 44, 46);
      }
      context.fillRect(snap(left + 10), 456, snap(stageWidth - 20), 92);
      context.strokeRect(snap(left + 10), 456, snap(stageWidth - 20), 92);
    } else if (
      /\b(?:shop|sale|buy|product|customer|subscription|price)\b/u.test(premise) ||
      segment.programme.format === 'shopping' ||
      segment.programme.format === 'advert'
    ) {
      for (let index = 0; index < 4; index += 1) {
        const width = 88 + (index % 2) * 34;
        const x = snap(left + 80 + index * (stageWidth / 4));
        const top = 260 - (index % 3) * 46;
        context.fillRect(x - width / 2, top, width, 220 - top + 250);
        context.strokeRect(x - width / 2, top, width, 220 - top + 250);
        context.fillStyle = colour(seed + index * 91, 74, 62);
        context.beginPath();
        context.arc(x, top - 26, 34 + (index % 2) * 10, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = colour(seed, 44, 46);
      }
    } else if (
      /\b(?:municipal|appeal|court|bureau|permit|council|official|office)\b/u.test(premise) ||
      segment.programme.format === 'public_access'
    ) {
      context.fillRect(snap(left + 20), 455, snap(stageWidth - 40), 92);
      context.strokeRect(snap(left + 20), 455, snap(stageWidth - 40), 92);
      for (let stack = 0; stack < 4; stack += 1) {
        const x = snap(left + 52 + stack * (stageWidth / 4.2));
        const count = 2 + ((seed >>> stack) % 4);
        for (let page = 0; page < count; page += 1) {
          context.fillStyle =
            page % 2 === 0 ? colour(seed + stack * 71, 34, 70) : colour(seed + 180, 48, 58);
          context.fillRect(x + page * 5, 430 - page * 22, 96 + stack * 8, 18);
          context.strokeRect(x + page * 5, 430 - page * 22, 96 + stack * 8, 18);
        }
      }
      context.fillStyle = colour(seed + 203, 52, 54);
      context.fillRect(snap(right - 154), 92, 128, 214);
      context.strokeRect(snap(right - 154), 92, 128, 214);
    } else {
      const motif = seed % 3;
      for (let index = 0; index < 5; index += 1) {
        const x = snap(left + 54 + index * (stageWidth / 5.2));
        if (motif === 0) {
          context.beginPath();
          context.arc(x, 176 + (index % 2) * 62, 30 + (index % 3) * 16, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          context.strokeRect(x - 3, 0, 6, 126 + (index % 2) * 42);
        } else if (motif === 1) {
          context.fillRect(x - 46, 104 + (index % 2) * 54, 92, 138);
          context.strokeRect(x - 46, 104 + (index % 2) * 54, 92, 138);
        } else {
          context.beginPath();
          context.moveTo(x, 78 + (index % 2) * 40);
          context.lineTo(x + 58, 248);
          context.lineTo(x - 58, 248);
          context.closePath();
          context.fill();
          context.stroke();
        }
      }
    }

    if (this.castArchetype === 'celestial') {
      context.fillStyle = this.medium === 'shadow_theatre' ? '#21130f' : colour(seed + 241, 64, 72);
      for (let index = 0; index < 9; index += 1) {
        const x = snap(left + 30 + ((seed + index * 157) % Math.max(1, stageWidth - 60)));
        const y = 62 + ((seed + index * 83) % 190);
        context.beginPath();
        context.arc(x, y, 4 + (index % 3) * 3, 0, Math.PI * 2);
        context.fill();
      }
    }

    context.globalAlpha *= 0.35 + Math.sin(elapsed * 0.18 + seed) * 0.025;
    context.restore();
  }

  private drawPremiseProp(premise: string, elapsed: number, motion: PacingMotionFrame): void {
    const context = this.context;
    context.save();
    const pixel = this.medium === 'pixel_broadcast';
    const shadow = this.medium === 'shadow_theatre';
    const thermal = this.medium === 'thermal_camera';
    const signal = this.medium === 'signal_corruption';
    const centre = this.stageCentre();
    context.translate(
      (pixel ? Math.round(centre / 16) * 16 : centre) + motion.propX,
      pixel
        ? Math.round((370 + Math.sin(elapsed * 3) * 4 + motion.propY) / 16) * 16
        : 370 + Math.sin(elapsed * 0.8) * 3 + motion.propY,
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

    const prop = premisePropKind(premise);
    if (prop === 'fridge') {
      roundedRect(context, -100, -210, 200, 350, 18);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(-100, -45);
      context.lineTo(100, -45);
      context.stroke();
      context.fillStyle = context.strokeStyle;
      context.fillRect(64, -170, 10, 82);
      context.fillRect(64, -10, 10, 62);
    } else if (prop === 'umbrella') {
      context.beginPath();
      context.arc(0, -62, 150, Math.PI, 0);
      context.lineTo(0, -62);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(0, -62);
      context.lineTo(0, 128);
      context.quadraticCurveTo(0, 178, 54, 154);
      context.stroke();
    } else if (prop === 'fish') {
      context.beginPath();
      context.ellipse(-12, -20, 126, 76, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(-128, -20);
      context.lineTo(-214, -92);
      context.lineTo(-214, 52);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = context.strokeStyle;
      context.beginPath();
      context.arc(62, -40, 10, 0, Math.PI * 2);
      context.fill();
    } else if (prop === 'letter') {
      context.fillRect(-150, -105, 300, 205);
      context.strokeRect(-150, -105, 300, 205);
      context.beginPath();
      context.moveTo(-150, -105);
      context.lineTo(0, 20);
      context.lineTo(150, -105);
      context.moveTo(-150, 100);
      context.lineTo(-30, -2);
      context.moveTo(150, 100);
      context.lineTo(30, -2);
      context.stroke();
    } else if (prop === 'bin') {
      context.beginPath();
      context.moveTo(-105, -105);
      context.lineTo(105, -105);
      context.lineTo(78, 138);
      context.lineTo(-78, 138);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillRect(-130, -132, 260, 32);
      context.strokeRect(-130, -132, 260, 32);
    } else if (prop === 'staircase') {
      for (let index = 0; index < 6; index += 1) {
        context.fillRect(-175 + index * 54, 84 - index * 44, 58, 44 + index * 44);
        context.strokeRect(-175 + index * 54, 84 - index * 44, 58, 44 + index * 44);
      }
    } else if (prop === 'phone') {
      roundedRect(context, -86, -196, 172, 330, 28);
      context.fill();
      context.stroke();
      context.fillStyle = context.strokeStyle;
      context.fillRect(-42, -162, 84, 9);
      context.beginPath();
      context.arc(0, 94, 22, 0, Math.PI * 2);
      context.fill();
    } else if (prop === 'chair') {
      context.fillRect(-104, -188, 208, 154);
      context.strokeRect(-104, -188, 208, 154);
      context.fillRect(-126, -34, 252, 54);
      context.strokeRect(-126, -34, 252, 54);
      context.fillRect(-92, 20, 22, 144);
      context.fillRect(70, 20, 22, 144);
    } else if (prop === 'key') {
      context.beginPath();
      context.arc(-98, -16, 76, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(-98, -16, 28, 0, Math.PI * 2);
      context.stroke();
      context.fillRect(-22, -34, 194, 38);
      context.strokeRect(-22, -34, 194, 38);
      context.fillRect(112, 4, 30, 48);
      context.fillRect(158, 4, 30, 70);
    } else if (prop === 'lamp') {
      context.beginPath();
      context.moveTo(-118, -54);
      context.lineTo(-68, -190);
      context.lineTo(68, -190);
      context.lineTo(118, -54);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillRect(-12, -54, 24, 188);
      context.fillRect(-82, 134, 164, 24);
    } else if (prop === 'door') {
      context.fillRect(-95, -190, 190, 310);
      context.strokeRect(-95, -190, 190, 310);
      context.beginPath();
      context.arc(52, -25, 11, 0, Math.PI * 2);
      context.fillStyle = '#182129';
      context.fill();
    } else if (prop === 'clock') {
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
    } else if (prop === 'house') {
      context.fillRect(-125, -80, 250, 190);
      context.strokeRect(-125, -80, 250, 190);
      context.beginPath();
      context.moveTo(-160, -80);
      context.lineTo(0, -220);
      context.lineTo(160, -80);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (prop === 'cup') {
      roundedRect(context, -85, -80, 170, 170, 28);
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(92, 0, 55, -Math.PI / 2, Math.PI / 2);
      context.stroke();
    } else if (prop === 'cloud') {
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

  private drawPacingGraphic(motion: PacingMotionFrame, elapsed: number): void {
    const context = this.context;
    context.save();
    if (this.pacing === 'frantic') {
      context.globalAlpha = 0.22 + motion.graphicPulse * 0.16;
      context.fillStyle = colour(Math.floor(elapsed * 53) + 180, 82, 62);
      const travel = (elapsed * 260) % 1_520;
      for (let index = 0; index < 5; index += 1) {
        context.fillRect(((travel + index * 310) % 1_520) - 120, 74 + index * 104, 142, 12);
      }
    } else if (this.pacing === 'staccato') {
      context.globalAlpha = 0.18 + motion.graphicPulse * 0.18;
      context.fillStyle = '#fff3a8';
      const size = 18 + Math.round(motion.graphicPulse * 32);
      for (const [x, y] of [
        [54, 54],
        [1_226 - size, 54],
        [54, 666 - size],
        [1_226 - size, 666 - size],
      ] as const) {
        context.fillRect(x, y, size, size);
      }
    } else if (this.pacing === 'interrupted' && motion.graphicPulse > 0.05) {
      context.globalAlpha = motion.graphicPulse * 0.32;
      context.fillStyle = '#ff4f68';
      context.translate(640, 360);
      context.rotate(-0.18);
      context.fillRect(-760, -26, 1_520, 52);
    } else if (this.pacing === 'slow_burn') {
      const sweep = ((elapsed * 34 + this.motionSeed * 1_280) % 1_680) - 200;
      const gradient = context.createLinearGradient(sweep - 180, 0, sweep + 180, 0);
      gradient.addColorStop(0, 'rgba(255, 245, 190, 0)');
      gradient.addColorStop(0.5, `rgba(255, 245, 190, ${0.05 + motion.graphicPulse * 0.06})`);
      gradient.addColorStop(1, 'rgba(255, 245, 190, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 44, 1_280, 610);
    } else if (this.pacing === 'near_silent') {
      context.globalAlpha = 0.12 + motion.graphicPulse * 0.12;
      context.strokeStyle = '#fff4c4';
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(
        640 + Math.sin(elapsed * 0.2) * 60,
        350,
        310 + motion.graphicPulse * 80,
        210 + motion.graphicPulse * 45,
        elapsed * 0.01,
        0,
        Math.PI * 2,
      );
      context.stroke();
    } else {
      context.globalAlpha = 0.2 + motion.graphicPulse * 0.14;
      context.fillStyle = '#fff4c4';
      context.beginPath();
      context.arc(1_194, 86, 5 + motion.graphicPulse * 4, 0, Math.PI * 2);
      context.fill();
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
    const design = character.design;
    const scale = closeUp ? 1.28 : 1;
    const x = closeUp ? this.stageCentre() : character.x;
    const y = (closeUp ? 420 : 500) + design.baselineOffset;
    context.save();
    context.translate(x + jitter, y);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
    const bodyWidth = (120 + (character.seed % 55)) * design.bodyScale;
    context.beginPath();
    if (design.silhouette === 'household_object') {
      if (design.variant % 3 === 0) {
        context.roundRect(-bodyWidth / 2, -210, bodyWidth, 300, 18);
      } else if (design.variant % 3 === 1) {
        context.moveTo(-bodyWidth * 0.62, 88);
        context.lineTo(-bodyWidth * 0.48, -190);
        context.lineTo(bodyWidth * 0.48, -190);
        context.lineTo(bodyWidth * 0.62, 88);
        context.closePath();
      } else {
        context.ellipse(0, -55, bodyWidth * 0.62, 150, 0, 0, Math.PI * 2);
      }
    } else if (design.silhouette === 'celestial_body') {
      if (design.variant % 3 === 0) {
        const points = 18;
        const radius = 126;
        for (let point = 0; point < points; point += 1) {
          const angle = (point / points) * Math.PI * 2;
          const distance = point % 2 === 0 ? radius * 1.34 : radius;
          const px = Math.cos(angle) * distance;
          const py = -155 + Math.sin(angle) * distance;
          if (point === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
      } else if (design.variant % 3 === 1) {
        context.arc(0, -155, 138, 0, Math.PI * 2);
      } else {
        context.arc(-70, -145, 92, Math.PI * 0.55, Math.PI * 1.75);
        context.arc(0, -205, 102, Math.PI * 0.95, Math.PI * 1.95);
        context.arc(80, -142, 88, Math.PI * 1.2, Math.PI * 0.45);
        context.quadraticCurveTo(0, 36, -70, -92);
        context.closePath();
      }
    } else if (design.silhouette === 'faceted_alien') {
      context.moveTo(-bodyWidth * 0.42, 90);
      context.lineTo(-bodyWidth * 0.64, -55);
      context.lineTo(-bodyWidth * 0.3, -140);
      context.lineTo(0, -170);
      context.lineTo(bodyWidth * 0.3, -140);
      context.lineTo(bodyWidth * 0.64, -55);
      context.lineTo(bodyWidth * 0.42, 90);
      context.closePath();
    } else if (this.medium === 'paper_cutout' || design.silhouette === 'jointed_puppet') {
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

    const faceY =
      design.silhouette === 'household_object'
        ? -85
        : design.silhouette === 'celestial_body'
          ? -155
          : -205;
    if (design.silhouette !== 'household_object' && design.silhouette !== 'celestial_body') {
      const headShape =
        design.silhouette === 'faceted_alien' ? design.variant % 3 : character.seed % 3;
      const headRadius = 84 * design.headScale;
      context.fillStyle = ink ? '#f2eddf' : colour(character.seed >>> 5, 38, 68);
      context.beginPath();
      if (headShape === 0) {
        context.arc(0, -190, headRadius, 0, Math.PI * 2);
      } else if (headShape === 1) {
        context.roundRect(
          -headRadius,
          -190 - headRadius,
          headRadius * 2,
          headRadius * 2,
          design.silhouette === 'jointed_puppet' ? 2 : 18,
        );
      } else {
        context.moveTo(0, -190 - headRadius * 1.18);
        context.lineTo(headRadius * 1.08, -190);
        context.lineTo(0, -190 + headRadius * 0.92);
        context.lineTo(-headRadius * 1.08, -190);
        context.closePath();
      }
      context.fill();
      context.stroke();
    }

    if (design.silhouette === 'household_object') {
      context.strokeStyle = '#172027';
      context.lineWidth = 7;
      if (design.variant % 3 === 0) {
        context.beginPath();
        context.arc(bodyWidth / 2 + 22, -86, 34, -Math.PI / 2, Math.PI / 2);
        context.stroke();
      } else if (design.variant % 3 === 1) {
        context.strokeRect(-bodyWidth * 0.3, -184, bodyWidth * 0.6, 28);
      } else {
        context.beginPath();
        context.moveTo(-bodyWidth * 0.3, -196);
        context.lineTo(0, -246);
        context.lineTo(bodyWidth * 0.3, -196);
        context.stroke();
      }
    } else if (design.silhouette === 'faceted_alien') {
      context.strokeStyle = '#172027';
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(0, -305);
      context.lineTo((design.variant % 2 === 0 ? -1 : 1) * 44, -354);
      context.stroke();
      context.beginPath();
      context.arc((design.variant % 2 === 0 ? -1 : 1) * 44, -354, 12, 0, Math.PI * 2);
      context.fillStyle = colour(character.seed + 153, 72, 64);
      context.fill();
    } else if (design.silhouette === 'celestial_body') {
      context.strokeStyle = '#172027';
      context.lineWidth = 11;
      if (design.variant % 3 === 1) {
        context.beginPath();
        context.ellipse(0, -155, 196, 54, -0.18, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = colour(character.seed + 191, 72, 68);
        context.beginPath();
        context.arc(174, -198, 18, 0, Math.PI * 2);
        context.fill();
      } else if (design.variant % 3 === 2) {
        context.beginPath();
        context.moveTo(-112, -48);
        context.quadraticCurveTo(-54, -12, 0, -46);
        context.quadraticCurveTo(56, -10, 116, -50);
        context.stroke();
      }
    }

    context.fillStyle = '#172027';
    const eyeCount = design.eyeCount;
    for (let index = 0; index < eyeCount; index += 1) {
      const eyeX = eyeCount === 1 ? 0 : (index - (eyeCount - 1) / 2) * 42;
      context.beginPath();
      context.arc(eyeX, faceY - (eyeCount === 3 && index === 1 ? 24 : 0), 8, 0, Math.PI * 2);
      context.fill();
    }

    const mouthHeight = speaking ? 10 + Math.abs(Math.sin(elapsed * 13)) * 24 : 5;
    context.fillRect(-27, faceY + 44 - mouthHeight / 2, 54, mouthHeight);

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
    if (design.silhouette === 'jointed_puppet') {
      context.fillStyle = '#172027';
      for (const jointX of [-bodyWidth / 2 - 12, bodyWidth / 2 + 12]) {
        context.beginPath();
        context.arc(jointX, -70, 11, 0, Math.PI * 2);
        context.fill();
      }
    }
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
    const design = character.design;
    const scale = closeUp ? 1.45 : 1;
    const x = closeUp ? this.stageCentre() : Math.round(character.x / 16) * 16;
    const y = (closeUp ? 450 : 512) + design.baselineOffset;
    const step = Math.floor(elapsed * 6 + character.seed) % 2;
    context.save();
    context.translate(x, y + step * 5);
    context.scale(scale * design.scaleX, scale * design.scaleY);
    const dark = '#10182f';
    const body = colour(character.seed, 70, 58);
    const face = colour(character.seed >>> 4, 70, 72);
    const accent = colour(character.seed + 137, 76, 62);

    if (design.silhouette === 'household_object') {
      context.fillStyle = body;
      if (design.variant % 3 === 0) {
        context.fillRect(-96, -238, 192, 264);
        context.fillStyle = accent;
        context.fillRect(-64, -270, 128, 32);
        context.fillRect(96, -186, 32, 112);
        context.fillRect(128, -154, 32, 48);
      } else if (design.variant % 3 === 1) {
        context.fillRect(-112, -206, 224, 208);
        context.fillStyle = accent;
        context.fillRect(-80, -254, 160, 48);
        context.fillRect(-64, -286, 128, 32);
      } else {
        context.fillRect(-96, -174, 192, 176);
        context.fillStyle = accent;
        context.fillRect(-128, -206, 256, 48);
        context.fillRect(-48, -270, 96, 64);
      }
      context.fillStyle = dark;
      context.fillRect(-48, -154, 16, 16);
      context.fillRect(32, -154, 16, 16);
      context.fillRect(-40, -112, 80, speaking ? 32 : 8);
      context.fillStyle = accent;
      context.fillRect(-70, 2, 44, 48);
      context.fillRect(26, 2, 44, 48);
    } else if (design.silhouette === 'celestial_body') {
      context.fillStyle = accent;
      for (const [rayX, rayY, width, height] of [
        [-24, -330, 48, 64],
        [-24, 4, 48, 64],
        [-192, -174, 64, 48],
        [128, -174, 64, 48],
        [-144, -286, 48, 48],
        [96, -286, 48, 48],
        [-144, -54, 48, 48],
        [96, -54, 48, 48],
      ] as const) {
        context.fillRect(rayX, rayY, width, height);
      }
      context.fillStyle = body;
      context.fillRect(-128, -250, 256, 160);
      context.fillRect(-96, -282, 192, 224);
      context.fillStyle = face;
      context.fillRect(-80, -266, 160, 192);
      context.fillStyle = dark;
      const eyeOffset = design.eyeCount === 1 ? 0 : 42;
      context.fillRect(-eyeOffset - 8, -194, 16, 16);
      if (design.eyeCount > 1) context.fillRect(eyeOffset - 8, -194, 16, 16);
      context.fillRect(-40, -146, 80, speaking ? 32 : 8);
    } else if (design.silhouette === 'faceted_alien') {
      context.fillStyle = body;
      if (design.variant % 3 === 0) {
        context.fillRect(-70, -142, 140, 168);
        context.fillRect(-48, 26, 32, 64);
        context.fillRect(16, 26, 32, 64);
        context.fillStyle = face;
        context.fillRect(-112, -254, 224, 96);
        context.fillRect(-80, -286, 160, 160);
      } else if (design.variant % 3 === 1) {
        context.fillRect(-52, -174, 104, 216);
        context.fillRect(-32, 42, 24, 64);
        context.fillRect(8, 42, 24, 64);
        context.fillStyle = face;
        context.fillRect(-64, -302, 128, 144);
        context.fillRect(-96, -270, 192, 80);
      } else {
        context.fillRect(-116, -126, 232, 152);
        context.fillRect(-82, 26, 42, 54);
        context.fillRect(40, 26, 42, 54);
        context.fillStyle = face;
        context.fillRect(-144, -246, 288, 80);
        context.fillRect(-96, -278, 192, 144);
      }
      context.fillStyle = accent;
      context.fillRect(-8, -334, 16, 48);
      context.fillRect(design.variant % 2 === 0 ? -24 : 8, -350, 32, 16);
      context.fillStyle = dark;
      for (let eye = 0; eye < design.eyeCount; eye += 1) {
        const eyeX = (eye - (design.eyeCount - 1) / 2) * 38;
        context.fillRect(Math.round(eyeX / 8) * 8 - 8, -220, 16, 24);
      }
      context.fillRect(-32, -174, 64, speaking ? 24 : 8);
    } else if (design.silhouette === 'jointed_puppet') {
      context.fillStyle = body;
      context.fillRect(-54, -164, 108, 190);
      context.fillStyle = face;
      context.fillRect(-72, -278, 144, 112);
      context.fillStyle = dark;
      context.fillRect(-40, -238, 16, 16);
      context.fillRect(24, -238, 16, 16);
      context.fillRect(-32, -198, 64, speaking ? 24 : 8);
      context.fillStyle = accent;
      context.fillRect(-102, -126, 32, 32);
      context.fillRect(70, -126, 32, 32);
      context.fillRect(-118, -94, 24, 134);
      context.fillRect(94, -94, 24, 134);
      context.fillRect(-42, 26, 24, 80);
      context.fillRect(18, 26, 24, 80);
      context.fillStyle = dark;
      context.fillRect(-90, -114, 12, 12);
      context.fillRect(78, -114, 12, 12);
    } else {
      context.fillStyle = dark;
      context.fillRect(-66, -260, 132, 92);
      context.fillStyle = body;
      context.fillRect(-82, -162, 164, 188);
      context.fillStyle = face;
      context.fillRect(-58, -244, 116, 76);
      context.fillStyle = dark;
      context.fillRect(-34, -220, 16, 16);
      context.fillRect(18, -220, 16, 16);
      context.fillRect(-30, -190, 60, speaking ? 24 : 8);
      context.fillStyle = accent;
      context.fillRect(-64, 26, 42, 64);
      context.fillRect(22, 26, 42, 64);
    }

    if (design.silhouette !== 'celestial_body') {
      const leftReach = character.action === 'POINT_AT' && acting ? -150 : -110;
      context.fillStyle = colour(character.seed, 70, 48);
      context.fillRect(leftReach, -132, Math.max(24, Math.abs(leftReach) - 70), 24);
      context.fillRect(82, -132, 42, 24);
    }
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
    const design = character.design;
    const scale = closeUp ? 1.3 : 1;
    const x = closeUp ? this.stageCentre() : character.x;
    const sway = Math.sin(elapsed * 1.7 + character.seed) * 0.035;
    context.save();
    context.translate(x, (closeUp ? 445 : 505) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
    context.rotate(sway);
    context.fillStyle = '#1c110e';
    context.strokeStyle = '#1c110e';
    context.lineWidth = 18;
    context.beginPath();
    if (design.silhouette === 'faceted_alien') {
      context.moveTo(0, -300);
      context.lineTo(94, -210);
      context.lineTo(0, -120);
      context.lineTo(-94, -210);
      context.closePath();
    } else if (design.silhouette === 'household_object') {
      context.rect(-94, -284, 188, 154);
    } else {
      context.arc(0, -210, design.silhouette === 'celestial_body' ? 128 : 70, 0, Math.PI * 2);
    }
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
    const design = character.design;
    const scale = closeUp ? 1.28 : 1;
    const x = closeUp ? this.stageCentre() : character.x;
    context.save();
    context.translate(x, (closeUp ? 438 : 500) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
    const design = character.design;
    const scale = closeUp ? 1.3 : 1;
    const x = closeUp ? this.stageCentre() : character.x;
    const glitch = Math.round(Math.sin(elapsed * 31 + character.seed) * 12);
    context.save();
    context.translate(x + glitch, (closeUp ? 440 : 500) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
    const design = character.design;
    const x = closeUp ? this.stageCentre() : character.x;
    const scale = closeUp ? 1.35 : 1;
    const frame = Math.floor(elapsed * 4 + character.seed) % 2;
    context.save();
    context.translate(x, (closeUp ? 440 : 500) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
    context.fillStyle = 'rgba(1, 12, 6, 0.9)';
    context.strokeStyle = '#48ff9d';
    context.lineWidth = 3;
    context.strokeRect(-108, -300, 216, 374);
    context.fillStyle = '#48ff9d';
    context.font = '30px monospace';
    const head =
      design.silhouette === 'household_object'
        ? frame === 0
          ? ' [o_o] '
          : ' {o_o} '
        : design.silhouette === 'celestial_body'
          ? frame === 0
            ? '*<O_O>*'
            : '+(o_o)+'
          : design.silhouette === 'faceted_alien'
            ? frame === 0
              ? ' /0|0\\ '
              : ' <o|o> '
            : frame === 0
              ? ' /O_O\\ '
              : ' |o_o| ';
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
    const design = character.design;
    const x = closeUp ? this.stageCentre() : character.x;
    const scale = closeUp ? 1.3 : 1;
    const reach = character.action === 'POINT_AT' && acting ? -175 : -112;
    context.save();
    context.translate(x, (closeUp ? 444 : 505) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
    const design = character.design;
    const x = closeUp ? this.stageCentre() : character.x;
    const scale = closeUp ? 1.25 : 1;
    context.save();
    context.translate(x, (closeUp ? 444 : 505) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
    const design = character.design;
    const x = closeUp ? this.stageCentre() : character.x;
    const scale = closeUp ? 1.28 : 1;
    const jump = Math.round(Math.sin(elapsed * 7 + character.seed)) * 3;
    context.save();
    context.translate(x + jump, (closeUp ? 442 : 503) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
    const design = character.design;
    const x = closeUp ? this.stageCentre() : character.x;
    const scale = closeUp ? 1.25 : 1;
    context.save();
    context.translate(x, (closeUp ? 444 : 505) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
    const design = character.design;
    const x = closeUp ? this.stageCentre() : character.x;
    const scale = closeUp ? 1.3 : 1;
    const explode = acting ? 16 : 6;
    context.save();
    context.translate(x, (closeUp ? 446 : 506) + design.baselineOffset);
    context.scale(scale * design.scaleX, scale * design.scaleY);
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
