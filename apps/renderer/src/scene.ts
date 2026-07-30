import * as THREE from 'three';
import type { SegmentPackage } from '@elsewhere-cable/schemas';
import { pacingMotionFrame, type PacingMode } from './motion-grammar.js';
import {
  resolveProductionDesign,
  type CastArchetype,
  type VisualMedium,
} from './production-design.js';
import type { ScheduledSoundCue } from './sound-design.js';
import { storyCueMotion } from './story-cue-motion.js';

const streamWidth = 1280;
const streamHeight = 720;
const defaultProgrammeViewport = {
  x: 34,
  y: 30,
  width: 880,
  height: 660,
} as const;

const wideProgrammeViewport = {
  x: 34,
  y: 30,
  width: 1_212,
  height: 660,
} as const;

interface ProgrammeViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CharacterRig {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyOutline: THREE.Mesh;
  head: THREE.Mesh;
  headOutline: THREE.Mesh;
  hair: THREE.Mesh;
  eyes: THREE.Mesh[];
  mouth: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  skinMaterial: THREE.MeshStandardMaterial;
  hairMaterial: THREE.MeshStandardMaterial;
  hat: THREE.Group;
  glasses: THREE.Group;
  antenna: THREE.Group;
  baseY: number;
  phase: number;
  action: CharacterAction;
  actionUntil: number;
}

interface MoonRig {
  group: THREE.Group;
  mouth: THREE.Mesh;
}

interface CloudRig {
  group: THREE.Group;
  mouth: THREE.Mesh;
}

interface ShoppingRig {
  group: THREE.Group;
  doorbell: THREE.Group;
  mug: THREE.Group;
}

interface PremiseProps {
  group: THREE.Group;
  items: Map<string, THREE.Group>;
}

type CameraName = 'CAMERA_WIDE' | 'CAMERA_HOST' | 'CAMERA_GUEST';
type CharacterAction =
  | 'IDLE'
  | 'ENTER'
  | 'EXIT'
  | 'LOOK_AT'
  | 'POINT_AT'
  | 'REACTION_NEUTRAL'
  | 'REACTION_CONFUSED'
  | 'REACTION_SHOCKED'
  | 'REACTION_ANGRY'
  | 'PAUSE'
  | 'FREEZE';

function createMaterial(color: number, roughness = 0.75): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.05,
    flatShading: true,
  });
}

function createCharacter(options: {
  bodyColor: number;
  skinColor: number;
  hairColor: number;
  x: number;
  phase: number;
}): CharacterRig {
  const group = new THREE.Group();
  group.position.set(options.x, 0, -0.4);
  const bodyMaterial = createMaterial(options.bodyColor);
  const skinMaterial = createMaterial(options.skinColor);
  const hairMaterial = createMaterial(options.hairColor, 0.95);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 2, 7), bodyMaterial);
  body.position.y = 1.85;
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x10161b,
    side: THREE.BackSide,
  });
  const bodyOutline = new THREE.Mesh(body.geometry, outlineMaterial);
  bodyOutline.position.copy(body.position);
  bodyOutline.scale.setScalar(1.07);
  bodyOutline.visible = false;
  group.add(bodyOutline, body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.34, 7), skinMaterial);
  neck.position.y = 3.02;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 1), skinMaterial);
  head.scale.set(0.9, 1.08, 0.88);
  head.position.y = 3.68;
  const headOutline = new THREE.Mesh(head.geometry, outlineMaterial);
  headOutline.position.copy(head.position);
  headOutline.scale.copy(head.scale).multiplyScalar(1.09);
  headOutline.visible = false;
  group.add(headOutline, head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.57, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMaterial,
  );
  hair.position.set(0, 3.98, 0);
  hair.scale.set(0.92, 0.62, 0.9);
  group.add(hair);

  const eyeMaterial = createMaterial(0x182025, 0.5);
  const eyes: THREE.Mesh[] = [];
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), eyeMaterial);
    eye.position.set(x, 3.76, 0.51);
    eyes.push(eye);
    group.add(eye);
  }
  const thirdEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), eyeMaterial);
  thirdEye.position.set(0, 4.02, 0.51);
  thirdEye.visible = false;
  eyes.push(thirdEye);
  group.add(thirdEye);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.055, 0.03),
    createMaterial(0x6d2736, 0.7),
  );
  mouth.position.set(0, 3.51, 0.54);
  group.add(mouth);

  function addArm(side: -1 | 1): THREE.Group {
    const arm = new THREE.Group();
    arm.position.set(side * 0.67, 2.55, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.15, 6), bodyMaterial);
    sleeve.position.y = -0.5;
    const hand = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), skinMaterial);
    hand.position.y = -1.12;
    arm.add(sleeve, hand);
    group.add(arm);
    return arm;
  }

  const leftArm = addArm(-1);
  const rightArm = addArm(1);

  const hat = new THREE.Group();
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 12), bodyMaterial);
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 0.55, 9), bodyMaterial);
  hatBrim.position.y = 4.18;
  hatCrown.position.y = 4.46;
  hat.add(hatBrim, hatCrown);
  hat.visible = false;
  group.add(hat);

  const glasses = new THREE.Group();
  const glassesMaterial = createMaterial(0x11191d, 0.35);
  for (const x of [-0.22, 0.22]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 14), glassesMaterial);
    lens.position.set(x, 3.76, 0.57);
    glasses.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), glassesMaterial);
  bridge.position.set(0, 3.76, 0.57);
  glasses.add(bridge);
  glasses.visible = false;
  group.add(glasses);

  const antenna = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6), hairMaterial);
  stem.position.y = 4.45;
  stem.rotation.z = -0.18;
  const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), bodyMaterial);
  tip.position.set(0.07, 4.8, 0);
  antenna.add(stem, tip);
  antenna.visible = false;
  group.add(antenna);

  group.scale.setScalar(0.92);

  return {
    group,
    body,
    bodyOutline,
    head,
    headOutline,
    hair,
    eyes,
    mouth,
    leftArm,
    rightArm,
    bodyMaterial,
    skinMaterial,
    hairMaterial,
    hat,
    glasses,
    antenna,
    baseY: group.position.y,
    phase: options.phase,
    action: 'IDLE',
    actionUntil: 0,
  };
}

const characterBodies: THREE.BufferGeometry[] = [
  new THREE.CylinderGeometry(0.62, 0.82, 2, 7),
  new THREE.BoxGeometry(1.35, 1.95, 0.86, 2, 2, 1),
  new THREE.SphereGeometry(0.92, 9, 6),
  new THREE.ConeGeometry(0.92, 2.15, 8),
  new THREE.IcosahedronGeometry(0.98, 1),
  new THREE.TorusKnotGeometry(0.62, 0.2, 32, 6),
];

const characterHeads: THREE.BufferGeometry[] = [
  new THREE.DodecahedronGeometry(0.62, 1),
  new THREE.BoxGeometry(1.05, 1.05, 0.92, 2, 2, 1),
  new THREE.SphereGeometry(0.64, 10, 7),
  new THREE.ConeGeometry(0.67, 1.25, 8),
  new THREE.IcosahedronGeometry(0.67, 1),
  new THREE.CylinderGeometry(0.52, 0.72, 1.08, 7),
];

const bodyColours = [0xa5374d, 0x3f68a4, 0xd28b32, 0x5c8b68, 0x8e4a96, 0x2f858b, 0xb35c35];
const skinColours = [
  0xc98d6a, 0x9e654a, 0xe1b087, 0x794936, 0xb97958, 0xd0a27f, 0x7dbb95, 0x799fc4, 0xb983bb,
  0xd0bd69,
];
const hairColours = [0x261c24, 0x18222c, 0x6b3e24, 0xd3c0a0, 0x491d28, 0x202018];

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function configureCharacter(
  character: CharacterRig,
  characterId: string,
  programmeId: string,
  index: number,
  castArchetype: CastArchetype,
  visualMedium: VisualMedium,
): void {
  const variant = stableHash(`${programmeId}:${characterId}`);
  const bodyIndex =
    castArchetype === 'humanoid'
      ? (variant + index) % 2
      : castArchetype === 'talking_objects'
        ? 1 + ((variant + index) % (characterBodies.length - 1))
        : (variant + index) % characterBodies.length;
  const headIndex =
    castArchetype === 'humanoid'
      ? [0, 2][(variant + index) % 2]!
      : ((variant >>> 3) + index * 2) % characterHeads.length;
  character.body.geometry = characterBodies[bodyIndex]!;
  character.head.geometry = characterHeads[headIndex]!;
  character.bodyOutline.geometry = character.body.geometry;
  character.headOutline.geometry = character.head.geometry;
  character.bodyMaterial.color.setHex(bodyColours[(variant >>> 5) % bodyColours.length]!);
  const skinIndex =
    castArchetype === 'humanoid'
      ? (variant >>> 8) % 6
      : castArchetype === 'geometric_aliens' || castArchetype === 'talking_objects'
        ? 6 + ((variant >>> 8) % (skinColours.length - 6))
        : (variant >>> 8) % skinColours.length;
  character.skinMaterial.color.setHex(skinColours[skinIndex]!);
  character.hairMaterial.color.setHex(hairColours[(variant >>> 11) % hairColours.length]!);
  const emissive =
    visualMedium === 'neon_wireframe' ||
    visualMedium === 'signal_corruption' ||
    visualMedium === 'thermal_camera'
      ? bodyColours[(variant >>> 5) % bodyColours.length]!
      : 0x000000;
  character.bodyMaterial.emissive.setHex(emissive);
  character.bodyMaterial.emissiveIntensity =
    visualMedium === 'neon_wireframe' ? 0.52 : emissive === 0x000000 ? 0 : 0.22;
  character.bodyMaterial.metalness = visualMedium === 'neon_wireframe' ? 0.32 : 0.05;
  const isGraphicMedium = [
    'cel_shaded',
    'ink_monochrome',
    'corporate_vector',
    'hand_drawn',
  ].includes(visualMedium);
  character.bodyMaterial.roughness = isGraphicMedium || visualMedium === 'claymation' ? 1 : 0.75;
  character.skinMaterial.roughness = isGraphicMedium || visualMedium === 'claymation' ? 1 : 0.75;
  character.skinMaterial.emissive.setHex(visualMedium === 'neon_wireframe' ? 0x241238 : 0x000000);
  character.skinMaterial.emissiveIntensity = visualMedium === 'neon_wireframe' ? 0.28 : 0;
  character.hairMaterial.emissive.setHex(visualMedium === 'neon_wireframe' ? 0x142f38 : 0x000000);
  character.hairMaterial.emissiveIntensity = visualMedium === 'neon_wireframe' ? 0.34 : 0;
  character.bodyMaterial.wireframe = false;
  character.skinMaterial.wireframe = false;
  character.hairMaterial.wireframe = false;

  const width = 0.78 + ((variant >>> 14) % 6) * 0.065;
  const height = 0.78 + ((variant >>> 18) % 7) * 0.055;
  character.group.scale.set(width, height, width);
  if (
    ['paper_cutout', 'collage_zine', 'ink_monochrome', 'corporate_vector', 'hand_drawn'].includes(
      visualMedium,
    ) ||
    castArchetype === 'paper_puppets'
  ) {
    character.group.scale.z = 0.16;
  }
  character.body.scale.set(
    0.78 + ((variant >>> 21) % 5) * 0.12,
    0.82 + ((variant >>> 24) % 5) * 0.1,
    0.82 + ((variant >>> 27) % 4) * 0.1,
  );
  character.head.scale.set(
    0.78 + ((variant >>> 9) % 5) * 0.11,
    0.82 + ((variant >>> 12) % 5) * 0.12,
    0.82 + ((variant >>> 16) % 4) * 0.1,
  );
  character.bodyOutline.scale.copy(character.body.scale).multiplyScalar(1.07);
  character.headOutline.scale.copy(character.head.scale).multiplyScalar(1.09);
  character.bodyOutline.visible = isGraphicMedium;
  character.headOutline.visible = isGraphicMedium;
  character.eyes.forEach((eye) => {
    eye.position.z = 0.78;
    eye.visible = true;
  });
  const eyeMode = variant % 7;
  if (eyeMode === 0) {
    character.eyes[0]!.position.set(0, 3.76, 0.78);
    character.eyes[1]!.visible = false;
    character.eyes[2]!.visible = false;
  } else if (eyeMode === 1 && castArchetype !== 'humanoid') {
    character.eyes[0]!.position.set(-0.22, 3.72, 0.78);
    character.eyes[1]!.position.set(0.22, 3.72, 0.78);
    character.eyes[2]!.position.set(0, 4.02, 0.78);
  } else {
    character.eyes[0]!.position.set(-0.2, 3.76, 0.78);
    character.eyes[1]!.position.set(0.2, 3.76, 0.78);
    character.eyes[2]!.visible = false;
  }
  character.mouth.position.z = 0.79;
  character.mouth.scale.x = 0.72 + (variant % 5) * 0.18;
  character.mouth.rotation.z = (((variant >>> 5) % 3) - 1) * 0.08;
  character.glasses.position.z = 0.21;
  character.hair.visible =
    castArchetype === 'humanoid' || (castArchetype === 'mixed' && variant % 5 !== 0);
  character.hat.visible =
    castArchetype !== 'talking_objects' && (variant % 7 === 0 || programmeId.includes('news'));
  character.glasses.visible =
    castArchetype !== 'geometric_aliens' && (variant % 4 === 0 || programmeId.includes('bureau'));
  character.antenna.visible =
    castArchetype === 'geometric_aliens' || variant % 11 === 0 || characterId.includes('buggy');
  character.leftArm.visible = castArchetype !== 'talking_objects' || variant % 3 !== 0;
  character.rightArm.visible = castArchetype !== 'talking_objects' || variant % 4 !== 0;
  const positions = [
    [-2.75, 0, -0.25],
    [2.75, -0.08, -0.25],
    [-0.95, 0.08, -1.25],
    [0.95, -0.02, -1.3],
    [-3.85, 0.12, -1.8],
    [3.85, 0.04, -1.85],
  ] as const;
  const position = positions[index % positions.length] ?? positions[0];
  character.group.position.set(position[0], position[1], position[2]);
  if (index >= 2) {
    character.group.scale.multiplyScalar(index >= 4 ? 0.67 : 0.78);
  }
  character.baseY = character.group.position.y;
}

function createDesk(): THREE.Group {
  const desk = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.25, 1.8), createMaterial(0x23363a));
  top.position.set(0, 1.2, 1);
  desk.add(top);

  const front = new THREE.Mesh(new THREE.BoxGeometry(7.1, 1.7, 0.25), createMaterial(0x192a2e));
  front.position.set(0, 0.34, 1.72);
  desk.add(front);

  const inset = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 0.82),
    new THREE.MeshStandardMaterial({
      color: 0x8df0d0,
      emissive: 0x1f594d,
      emissiveIntensity: 0.55,
      roughness: 0.7,
    }),
  );
  inset.position.set(0, 0.48, 1.855);
  desk.add(inset);
  return desk;
}

function createDreamModel(): THREE.Group {
  const model = new THREE.Group();
  const steps = createMaterial(0xd5bc75);
  for (let index = 0; index < 7; index += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 0.42), steps);
    step.position.set(index * 0.38, index * 0.24, 0);
    model.add(step);
  }
  model.position.set(-1.1, 1.72, 0.5);
  model.rotation.y = -0.35;
  model.scale.setScalar(0.68);
  return model;
}

function createNewsModel(): THREE.Group {
  const model = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.25, 0.16), createMaterial(0x13263d));
  board.position.set(0, 3.55, -2.95);
  model.add(board);

  const roundabout = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.12, 8, 24),
    createMaterial(0xf3bf63, 0.45),
  );
  roundabout.position.set(0, 3.55, -2.82);
  model.add(roundabout);

  for (let index = 0; index < 4; index += 1) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.18, 0.05), createMaterial(0x8ca4b8));
    road.position.set(0, 3.55, -2.79);
    road.rotation.z = (index * Math.PI) / 2;
    model.add(road);
  }
  return model;
}

function createShoppingModel(): ShoppingRig {
  const model = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.35, 1.25, 8),
    createMaterial(0x6e315e),
  );
  pedestal.position.set(0, 0.62, 0.2);
  model.add(pedestal);

  const doorbell = new THREE.Group();
  const product = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 1.55, 0.42),
    createMaterial(0xf2c875, 0.4),
  );
  product.position.set(0, 1.95, 0.2);
  model.add(product);

  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.12, 14),
    createMaterial(0xb52e4d, 0.35),
  );
  button.rotation.x = Math.PI / 2;
  button.position.set(0, 2.02, 0.45);
  doorbell.add(product, button);
  model.add(doorbell);

  const mug = new THREE.Group();
  const mugMaterial = createMaterial(0x8cd0cf, 0.3);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 1.25, 9), mugMaterial);
  cup.position.set(0, 1.85, 0.2);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.1, 7, 14), mugMaterial);
  handle.position.set(0.56, 1.85, 0.2);
  handle.rotation.y = Math.PI / 2;
  mug.add(cup, handle);
  mug.visible = false;
  model.add(mug);
  return { group: model, doorbell, mug };
}

function createMoonModel(): MoonRig {
  const model = new THREE.Group();
  const moon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.05, 2),
    createMaterial(0xd6d0ad, 0.95),
  );
  moon.position.set(0, 3.5, -1.9);
  model.add(moon);

  const eyeMaterial = createMaterial(0x28323c, 0.6);
  for (const x of [-0.55, 0.55]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), eyeMaterial);
    eye.position.set(x, 3.78, -0.02);
    model.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 0.08), eyeMaterial);
  mouth.position.set(0, 2.95, 0.02);
  model.add(mouth);

  for (const [x, y, scale] of [
    [-2.8, 4.9, 0.75],
    [2.6, 2.3, 0.55],
    [3, 5.3, 0.42],
  ] as const) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.72, 8, 5), createMaterial(0xc3d7d7, 1));
    cloud.position.set(x, y, -2.6);
    cloud.scale.set(1.65 * scale, 0.58 * scale, scale);
    model.add(cloud);
  }
  return { group: model, mouth };
}

function createCloudModel(): CloudRig {
  const group = new THREE.Group();
  const cloudMaterial = createMaterial(0xbdd9de, 1);
  for (const [x, y, scale] of [
    [-0.5, 0, 0.82],
    [0.1, 0.15, 1],
    [0.68, -0.02, 0.72],
  ] as const) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.72, 9, 6), cloudMaterial);
    puff.position.set(x, y, 0);
    puff.scale.setScalar(scale);
    group.add(puff);
  }
  const faceMaterial = createMaterial(0x263a45, 0.6);
  for (const x of [-0.18, 0.28]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 5), faceMaterial);
    eye.position.set(x, 0.17, 0.64);
    group.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.055, 0.035), faceMaterial);
  mouth.position.set(0.05, -0.16, 0.67);
  group.add(mouth);
  group.position.set(3.05, 3, -0.35);
  return { group, mouth };
}

function createSitcomModel(): THREE.Group {
  const model = new THREE.Group();
  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(4.7, 1.05, 1.4), createMaterial(0x8a4c38));
  sofaBase.position.set(0, 0.65, 0.4);
  model.add(sofaBase);

  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(4.9, 1.35, 0.45), createMaterial(0x9d5c43));
  sofaBack.position.set(0, 1.48, -0.13);
  model.add(sofaBack);

  const lampPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.1, 7),
    createMaterial(0x58432d),
  );
  lampPost.position.set(3.35, 1.55, -0.4);
  model.add(lampPost);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.82, 0.9, 8, 1, true),
    createMaterial(0xe0ba6d),
  );
  shade.position.set(3.35, 3.15, -0.4);
  model.add(shade);
  return model;
}

function createLettersModel(): THREE.Group {
  const model = new THREE.Group();
  for (let index = 0; index < 9; index += 1) {
    const letter = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.04, 0.72),
      createMaterial(index % 3 === 0 ? 0xd8b78a : 0xebe0c5, 1),
    );
    letter.position.set(
      ((index % 3) - 1) * 0.42,
      1.58 + Math.floor(index / 3) * 0.08,
      0.75 + (index % 2) * 0.06,
    );
    letter.rotation.y = (index - 4) * 0.045;
    model.add(letter);
  }
  return model;
}

function propGroup(name: string, ...meshes: THREE.Object3D[]): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  group.add(...meshes);
  group.visible = false;
  return group;
}

function createPremiseProps(): PremiseProps {
  const material = createMaterial(0xf0c565, 0.56);
  const dark = createMaterial(0x20323b, 0.72);
  const items = new Map<string, THREE.Group>();

  const door = propGroup(
    'door',
    new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.1, 0.22), material),
    new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dark),
  );
  door.children[1]!.position.set(0.48, 0, 0.18);
  items.set('door', door);

  const fridge = propGroup(
    'fridge',
    new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.2, 1.15), createMaterial(0xc9dde0, 0.4)),
    new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 0.08), dark),
  );
  fridge.children[1]!.position.set(0.55, 0.45, 0.64);
  items.set('fridge', fridge);

  const umbrella = propGroup(
    'umbrella',
    new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      createMaterial(0xd14f6d, 0.7),
    ),
    new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), dark),
  );
  umbrella.children[0]!.position.y = 0.9;
  items.set('umbrella', umbrella);

  const fish = propGroup(
    'fish',
    new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 7), createMaterial(0x69d2c4, 0.52)),
    new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 3), createMaterial(0x4eaaa7, 0.6)),
  );
  fish.children[0]!.scale.set(1.6, 0.72, 0.52);
  fish.children[1]!.position.x = -1.25;
  fish.children[1]!.rotation.z = -Math.PI / 2;
  items.set('fish', fish);

  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 18), material);
  clockFace.rotation.x = Math.PI / 2;
  const clockHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), dark);
  clockHand.position.set(0.18, 0.15, 0.14);
  clockHand.rotation.z = -0.55;
  items.set('clock', propGroup('clock', clockFace, clockHand));

  const house = propGroup(
    'house',
    new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 1.4), createMaterial(0xb66855, 0.7)),
    new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.1, 4), createMaterial(0x563240, 0.8)),
  );
  house.children[1]!.position.y = 1.35;
  house.children[1]!.rotation.y = Math.PI / 4;
  items.set('house', house);

  const cup = propGroup(
    'cup',
    new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 1.25, 10), createMaterial(0x87cbd1, 0.4)),
    new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.1, 7, 14), createMaterial(0x87cbd1, 0.4)),
  );
  cup.children[1]!.position.x = 0.58;
  cup.children[1]!.rotation.y = Math.PI / 2;
  items.set('cup', cup);

  const cloud = propGroup(
    'cloud',
    ...[-0.7, 0, 0.72].map((x, index) => {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 9, 6),
        createMaterial(0xd4e2de, 1),
      );
      puff.position.set(x, index === 1 ? 0.25 : 0, 0);
      return puff;
    }),
  );
  items.set('cloud', cloud);

  const bin = propGroup(
    'bin',
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.58, 1.65, 10),
      createMaterial(0x465b59, 0.82),
    ),
    new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.14, 10), dark),
  );
  bin.children[1]!.position.y = 0.9;
  items.set('bin', bin);

  const letter = propGroup(
    'letter',
    new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.05), createMaterial(0xe4d4ac, 1)),
    new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.04), dark),
  );
  letter.children[1]!.position.set(0, 0.08, 0.12);
  items.set('letter', letter);

  const staircase = new THREE.Group();
  for (let index = 0; index < 6; index += 1) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.6), material);
    step.position.set(index * 0.34, index * 0.24, 0);
    staircase.add(step);
  }
  staircase.name = 'staircase';
  staircase.visible = false;
  items.set('staircase', staircase);

  const abstract = propGroup(
    'abstract',
    new THREE.Mesh(new THREE.TorusKnotGeometry(0.7, 0.18, 36, 7), createMaterial(0xaf55c2, 0.28)),
    new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), createMaterial(0x64d6bf, 0.35)),
  );
  abstract.children[1]!.position.set(1.35, -0.15, 0);
  items.set('abstract', abstract);

  const group = new THREE.Group();
  group.add(...items.values());
  group.position.set(0, 2.05, -1);
  return { group, items };
}

export class BroadcastScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly characters: CharacterRig[];
  private readonly dreamModel = createDreamModel();
  private readonly newsModel = createNewsModel();
  private readonly shoppingModel = createShoppingModel();
  private readonly moon = createMoonModel();
  private readonly cloud = createCloudModel();
  private readonly sitcomModel = createSitcomModel();
  private readonly lettersModel = createLettersModel();
  private readonly premiseProps = createPremiseProps();
  private readonly desk = createDesk();
  private readonly wallMaterial = createMaterial(0x315b59, 1);
  private readonly floorMaterial = createMaterial(0x132527, 0.9);
  private readonly stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x89dfc2 });
  private readonly stripes: THREE.Mesh[] = [];
  private readonly warningLight: THREE.PointLight;
  private readonly characterIds = new Map<string, number>();
  private activeSpeaker = 0;
  private activeSpeakerUntil = 0;
  private moonSpeakerUntil = 0;
  private cloudSpeakerUntil = 0;
  private currentCamera: CameraName = 'CAMERA_WIDE';
  private cameraPosition = new THREE.Vector3(0, 4.2, 12.8);
  private cameraTarget = new THREE.Vector3(0, 2.15, 0);
  private profile = 'public_access';
  private pacing: PacingMode = 'conversational';
  private motionSeed = 0;
  private viewport: ProgrammeViewport = { ...defaultProgrammeViewport };
  private segmentStartedAt = 0;
  private renderScale = 1;
  private displayScale = 1;
  private activeStoryCue: ScheduledSoundCue | null = null;
  private activeStoryCueStartedAt = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(streamWidth, streamHeight, false);
    this.renderer.setClearColor(0x030708, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x213f41);
    this.scene.fog = new THREE.Fog(0x213f41, 12, 24);
    this.camera.position.set(0, 4.2, 12.8);
    this.camera.lookAt(0, 2.15, 0);

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 13), this.wallMaterial);
    wall.position.set(0, 5.4, -4.1);
    this.scene.add(wall);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    for (let index = -2; index <= 2; index += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 10, 0.06), this.stripeMaterial);
      stripe.position.set(index * 3.5, 5, -4);
      stripe.rotation.z = index % 2 === 0 ? 0.08 : -0.08;
      this.stripes.push(stripe);
      this.scene.add(stripe);
    }

    this.scene.add(
      this.desk,
      this.dreamModel,
      this.newsModel,
      this.shoppingModel.group,
      this.moon.group,
      this.cloud.group,
      this.sitcomModel,
      this.lettersModel,
      this.premiseProps.group,
    );

    this.characters = Array.from({ length: 6 }, (_, index) =>
      createCharacter({
        bodyColor: bodyColours[index % bodyColours.length]!,
        skinColor: skinColours[index % skinColours.length]!,
        hairColor: hairColours[index % hairColours.length]!,
        x: index % 2 === 0 ? -2.3 : 2.4,
        phase: index * 1.17,
      }),
    );
    this.scene.add(...this.characters.map((character) => character.group));

    const ambient = new THREE.HemisphereLight(0xd8fff4, 0x263b3b, 1.8);
    const key = new THREE.DirectionalLight(0xffe2c5, 3.8);
    key.position.set(-4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const fill = new THREE.DirectionalLight(0x9acaff, 2.4);
    fill.position.set(5, 6, 2);
    this.warningLight = new THREE.PointLight(0xff5d65, 0, 8, 2);
    this.warningLight.position.set(0, 5, -1);
    this.scene.add(ambient, key, fill, this.warningLight);

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  loadSegment(segment: SegmentPackage): void {
    const productionDesign = resolveProductionDesign(segment);
    this.renderScale = productionDesign.visualMedium === 'pixel_broadcast' ? 0.25 : 1;
    this.updateRenderResolution();
    this.segmentStartedAt = this.clock.getElapsedTime();
    this.activeStoryCue = null;
    this.activeStoryCueStartedAt = 0;
    this.profile = segment.programme.format;
    this.pacing = segment.pacing ?? 'conversational';
    this.motionSeed =
      (stableHash(`${segment.channel.id}:${segment.programme.id}:motion`) % 10_000) / 10_000;
    this.viewport = { ...defaultProgrammeViewport };
    this.camera.aspect = this.viewport.width / this.viewport.height;
    this.camera.updateProjectionMatrix();
    this.characterIds.clear();
    const speakingCharacters = segment.events
      .filter((event) => event.type === 'speech.play')
      .map((event) => event.characterId);
    for (const characterId of speakingCharacters) {
      if (!this.characterIds.has(characterId)) {
        this.characterIds.set(characterId, this.characterIds.size % this.characters.length);
      }
    }
    const visibleCharacterCount = Math.min(4, Math.max(this.characterIds.size, 2));

    this.desk.visible = false;
    this.dreamModel.visible = false;
    this.newsModel.visible = false;
    this.shoppingModel.group.visible = false;
    this.shoppingModel.doorbell.visible = false;
    this.shoppingModel.mug.visible = false;
    this.moon.group.visible = false;
    this.cloud.group.visible = false;
    this.sitcomModel.visible = false;
    this.lettersModel.visible = false;
    this.premiseProps.items.forEach((item) => {
      item.visible = false;
    });
    this.stripes.forEach((stripe) => {
      stripe.visible = false;
    });
    this.characters.forEach((character, index) => {
      character.group.visible = index < visibleCharacterCount;
      character.group.rotation.set(0, 0, 0);
      character.action = 'IDLE';
      character.actionUntil = 0;
      const characterId =
        [...this.characterIds.entries()].find((entry) => entry[1] === index)?.[0] ??
        `${segment.programme.id}_background_${index}`;
      configureCharacter(
        character,
        characterId,
        segment.programme.id,
        index,
        productionDesign.castArchetype,
        productionDesign.visualMedium,
      );
    });
    const formations: Record<number, readonly number[]> = {
      2: [-2.7, 2.7],
      3: [-3.25, 0, 3.25],
      4: [-3.6, -1.25, 1.25, 3.6],
    };
    const formation = formations[visibleCharacterCount] ?? formations[2]!;
    this.characters.slice(0, visibleCharacterCount).forEach((character, index) => {
      character.group.position.x = formation[index] ?? 0;
      character.group.position.z = index % 2 === 0 ? -0.4 : -0.62;
      if (visibleCharacterCount >= 3) {
        character.group.scale.multiplyScalar(visibleCharacterCount === 4 ? 0.72 : 0.8);
      }
      character.baseY = character.group.position.y;
    });

    const premise = segment.programme.premise.toLowerCase();
    const propKeywords: Array<[string, RegExp]> = [
      ['door', /\b(?:door|entrance|threshold)\b/u],
      ['fridge', /\b(?:fridge|refrigerator|appliance)\b/u],
      ['umbrella', /\b(?:umbrella|rain|weather)\b/u],
      ['fish', /\b(?:fish|aquarium|tide|sea)\b/u],
      ['clock', /\b(?:clock|time|minute|day|thursday)\b/u],
      ['house', /\b(?:house|home|property|family)\b/u],
      ['cup', /\b(?:cup|kettle|kitchen|ingredient)\b/u],
      ['cloud', /\b(?:cloud|sky|sun|moon)\b/u],
      ['bin', /\b(?:bin|rubbish|waste)\b/u],
      ['letter', /\b(?:letter|receipt|manual|post|address)\b/u],
      ['staircase', /\b(?:stair|floor|lift)\b/u],
    ];
    const matchingProps = propKeywords.filter(([, pattern]) => pattern.test(premise)).slice(0, 2);
    this.premiseProps.group.position.set(0, 3.35, -3.25);
    this.premiseProps.group.scale.setScalar(0.68);
    matchingProps.forEach(([name], index) => {
      const item = this.premiseProps.items.get(name);
      if (item !== undefined) {
        item.visible = true;
        item.position.set(index === 0 ? -0.7 : 2.4, index === 0 ? 0 : -0.25, index * -0.4);
        item.rotation.y = (stableHash(`${segment.segmentId}:${name}`) % 9) * 0.09 - 0.36;
      }
    });
    switch (segment.programme.format) {
      case 'news':
        this.useWideViewport();
        this.applyPalette(0x132a43, 0x08121e, 0xdb3d4b);
        this.desk.visible = true;
        this.newsModel.visible = /\b(?:roundabout|traffic|road)\b/u.test(premise);
        this.stripes.slice(0, 2).forEach((stripe) => {
          stripe.visible = true;
        });
        break;
      case 'shopping':
      case 'advert':
        this.useWideViewport();
        this.applyPalette(
          segment.channel.number === 802 ? 0x123945 : 0x54204e,
          segment.channel.number === 802 ? 0x07181f : 0x1b0b22,
          segment.channel.number === 802 ? 0x68e0d2 : 0xf3c858,
        );
        if (premise.includes('doorbell')) {
          this.shoppingModel.group.visible = true;
          this.shoppingModel.doorbell.visible = true;
          this.premiseProps.items.forEach((item) => {
            item.visible = false;
          });
        } else if (/\b(?:cup|mug|kettle)\b/u.test(premise)) {
          this.shoppingModel.group.visible = true;
          this.shoppingModel.mug.visible = true;
          this.premiseProps.items.forEach((item) => {
            item.visible = false;
          });
        }
        this.characters[0]!.group.position.x = -3.05;
        this.characters[1]!.group.position.x = 3.05;
        break;
      case 'sitcom':
        this.useWideViewport();
        this.applyPalette(0x74513f, 0x2b1a1d, 0xf3b56b);
        this.sitcomModel.visible = true;
        this.characters[0]!.group.position.x = -1.55;
        this.characters[1]!.group.position.x = 1.6;
        this.characters.forEach((character) => {
          character.group.position.z = 0.25;
        });
        break;
      case 'ident':
        this.useWideViewport();
        this.applyPalette(0x172743, 0x07101f, 0x9bcde2);
        if (/\b(?:moon|sun|planet|star|sky)\b/u.test(premise)) {
          this.moon.group.visible = true;
          this.cloud.group.visible = true;
          this.characters.forEach((character) => {
            character.group.visible = false;
          });
          this.premiseProps.items.forEach((item) => {
            item.visible = false;
          });
        }
        break;
      case 'emergency':
        this.useWideViewport();
        this.applyPalette(0x42131a, 0x150407, 0xff3a42);
        this.desk.visible = true;
        this.stripes.forEach((stripe) => {
          stripe.visible = true;
        });
        break;
      case 'public_access':
      default:
        this.stripes.forEach((stripe) => {
          stripe.visible = true;
        });
        this.desk.visible = true;
        if (premise.includes('dream')) {
          this.applyPalette(0x315b59, 0x132527, 0x89dfc2);
          this.dreamModel.visible = true;
          this.premiseProps.items.forEach((item) => {
            item.visible = false;
          });
        } else if (/\b(?:letter|receipt|post|address)\b/u.test(premise)) {
          this.applyPalette(0x514735, 0x211c16, 0xd8b272);
          this.lettersModel.visible = true;
        } else {
          const palette = stableHash(segment.segmentId);
          this.applyPalette(
            bodyColours[palette % bodyColours.length]!,
            0x17121f,
            skinColours[(palette >>> 4) % skinColours.length]!,
          );
        }
        break;
    }
    this.cutCamera('CAMERA_WIDE');
  }

  cutCamera(camera: CameraName): void {
    this.currentCamera = camera;
    if (this.profile === 'ident') {
      if (camera === 'CAMERA_GUEST') {
        this.cameraPosition.set(2.35, 3.25, 8.5);
        this.cameraTarget.set(2.85, 2.7, 0);
      } else if (camera === 'CAMERA_HOST') {
        this.cameraPosition.set(0, 3.8, 7.25);
        this.cameraTarget.set(0, 3.45, -1.9);
      } else {
        this.cameraPosition.set(0, 4.2, 12.8);
        this.cameraTarget.set(0, 2.9, -0.8);
      }
    } else if (camera === 'CAMERA_HOST') {
      this.cameraPosition.set(-2.4, 3.7, 8);
      this.cameraTarget.set(-2.15, 2.5, 0);
    } else if (camera === 'CAMERA_GUEST') {
      this.cameraPosition.set(2.4, 3.7, 8);
      this.cameraTarget.set(2.15, 2.5, 0);
    } else {
      this.cameraPosition.set(0, 4.2, 12.8);
      this.cameraTarget.set(0, 2.15, 0);
    }
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
  }

  speak(characterId: string, durationMs: number): void {
    const elapsed = this.clock.getElapsedTime();
    if (characterId.toLowerCase().includes('moon')) {
      this.moonSpeakerUntil = elapsed + durationMs / 1_000;
      return;
    }
    if (characterId.toLowerCase().includes('cloud')) {
      this.cloudSpeakerUntil = elapsed + durationMs / 1_000;
      return;
    }
    this.activeSpeaker = this.characterIds.get(characterId) ?? 0;
    this.activeSpeakerUntil = elapsed + durationMs / 1_000;
    if (this.currentCamera !== 'CAMERA_WIDE') {
      const character = this.characters[this.activeSpeaker];
      if (character !== undefined) {
        this.cameraPosition.set(character.group.position.x, 3.7, 8);
        this.cameraTarget.set(character.group.position.x, 2.5, character.group.position.z);
        this.camera.position.copy(this.cameraPosition);
        this.camera.lookAt(this.cameraTarget);
      }
    }
  }

  performAction(characterId: string, action: CharacterAction): void {
    const index = this.characterIds.get(characterId) ?? 0;
    const character = this.characters[index];
    if (character === undefined) {
      return;
    }
    const elapsed = this.clock.getElapsedTime();
    character.action = action;
    character.actionUntil = elapsed + (action === 'FREEZE' ? 2.4 : 1.4);
    if (action === 'ENTER') {
      character.group.visible = true;
    }
    if (action === 'EXIT') {
      character.group.visible = false;
    }
  }

  performStoryCue(cue: ScheduledSoundCue): void {
    this.activeStoryCue = cue;
    this.activeStoryCueStartedAt = this.clock.getElapsedTime();
  }

  private applyPalette(background: number, floor: number, accent: number): void {
    this.scene.background = new THREE.Color(background);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setHex(background);
    }
    this.wallMaterial.color.setHex(background);
    this.floorMaterial.color.setHex(floor);
    this.stripeMaterial.color.setHex(accent);
  }

  private useWideViewport(): void {
    this.viewport = { ...wideProgrammeViewport };
    this.camera.aspect = this.viewport.width / this.viewport.height;
    this.camera.updateProjectionMatrix();
  }

  private readonly resize = (): void => {
    const canvas = this.renderer.domElement;
    const bounds = canvas.getBoundingClientRect();
    this.displayScale = Math.min(window.devicePixelRatio, 1.25);
    if (bounds.width > 0 && bounds.height > 0) {
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
    }
    this.updateRenderResolution();
  };

  private updateRenderResolution(): void {
    this.renderer.setPixelRatio(this.renderScale < 1 ? 1 : this.displayScale);
    this.renderer.setSize(
      Math.round(streamWidth * this.renderScale),
      Math.round(streamHeight * this.renderScale),
      false,
    );
  }

  getRendererInfo(): { api: string; device: string; vendor: string } {
    const gl = this.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const parameterAsString = (parameter: number): string => {
      const value: unknown = gl.getParameter(parameter);
      return String(value);
    };
    const device = parameterAsString(
      debugInfo === null ? gl.RENDERER : debugInfo.UNMASKED_RENDERER_WEBGL,
    );
    const vendor = parameterAsString(
      debugInfo === null ? gl.VENDOR : debugInfo.UNMASKED_VENDOR_WEBGL,
    );

    return {
      api: gl instanceof WebGL2RenderingContext ? 'WebGL 2' : 'WebGL 1',
      device,
      vendor,
    };
  }

  render(): void {
    const elapsed = this.clock.getElapsedTime();
    const segmentElapsed = Math.max(0, elapsed - this.segmentStartedAt);
    const motion = pacingMotionFrame(this.pacing, segmentElapsed, this.motionSeed);
    const cueMotion = storyCueMotion(
      this.activeStoryCue,
      (elapsed - this.activeStoryCueStartedAt) * 1_000,
    );

    this.characters.forEach((character, index) => {
      const speech =
        index === this.activeSpeaker && elapsed < this.activeSpeakerUntil
          ? Math.abs(Math.sin(elapsed * 13 + character.phase))
          : 0;
      character.mouth.scale.y = 0.45 + speech * 4;
      if (character.action === 'FREEZE' && elapsed < character.actionUntil) {
        return;
      }
      character.group.position.y =
        character.baseY +
        Math.sin(elapsed * 1.2 + character.phase) * 0.028 +
        motion.actorBob * 0.008 * (index === this.activeSpeaker ? 1.35 : 0.55);
      character.group.rotation.y =
        Math.sin(elapsed * 0.45 + character.phase) * 0.035 +
        motion.actorSway * 0.004 * (index % 2 === 0 ? 1 : -1);
      character.group.rotation.z =
        character.action === 'REACTION_CONFUSED' && elapsed < character.actionUntil
          ? Math.sin(elapsed * 3) * 0.12
          : character.action === 'REACTION_SHOCKED' && elapsed < character.actionUntil
            ? Math.sin(elapsed * 18) * 0.08
            : character.action === 'LOOK_AT' && elapsed < character.actionUntil
              ? (index % 2 === 0 ? 1 : -1) * 0.08
              : character.action === 'PAUSE' && elapsed < character.actionUntil
                ? (index % 2 === 0 ? 1 : -1) * 0.045
                : 0;
      character.leftArm.rotation.z =
        character.action === 'REACTION_ANGRY' && elapsed < character.actionUntil
          ? -0.8
          : character.action === 'REACTION_NEUTRAL' && elapsed < character.actionUntil
            ? -0.28
            : 0.18 + Math.sin(elapsed * 0.8 + character.phase) * 0.08;
      character.rightArm.rotation.z =
        character.action === 'POINT_AT' && elapsed < character.actionUntil
          ? -1.05
          : -0.18 -
            (index === this.activeSpeaker && elapsed < this.activeSpeakerUntil
              ? Math.sin(elapsed * 1.9) * 0.3
              : 0);
    });

    this.dreamModel.rotation.y = -0.35 + Math.sin(elapsed * 0.45) * 0.12;
    this.dreamModel.rotation.z = cueMotion.rotation;
    this.dreamModel.position.x = -1.1 + cueMotion.x * 0.012;
    this.dreamModel.position.y =
      1.72 + Math.sin(elapsed * 0.8) * 0.025 - cueMotion.y * 0.012;
    this.dreamModel.scale.set(
      0.68 * cueMotion.scaleX,
      0.68 * cueMotion.scaleY,
      0.68,
    );
    this.newsModel.rotation.z = Math.sin(elapsed * 0.35) * 0.025 + cueMotion.rotation;
    this.newsModel.position.x = cueMotion.x * 0.012;
    this.newsModel.position.y = -cueMotion.y * 0.012;
    this.newsModel.scale.set(cueMotion.scaleX, cueMotion.scaleY, 1);
    this.shoppingModel.group.rotation.y = Math.sin(elapsed * 0.85) * 0.18;
    this.shoppingModel.group.rotation.z = cueMotion.rotation;
    this.shoppingModel.group.position.x = cueMotion.x * 0.012;
    this.shoppingModel.group.position.y = -cueMotion.y * 0.012;
    this.shoppingModel.group.scale.set(cueMotion.scaleX, cueMotion.scaleY, 1);
    this.shoppingModel.doorbell.scale.setScalar(1 + Math.max(0, Math.sin(elapsed * 3)) * 0.025);
    this.shoppingModel.mug.position.y = -Math.min(0.28, (elapsed - this.segmentStartedAt) * 0.009);
    this.lettersModel.position.x = cueMotion.x * 0.012;
    this.lettersModel.position.y =
      Math.sin(elapsed * 0.7) * 0.025 - cueMotion.y * 0.012;
    this.lettersModel.rotation.z = cueMotion.rotation;
    this.lettersModel.scale.set(cueMotion.scaleX, cueMotion.scaleY, 1);
    this.moon.group.rotation.z = Math.sin(elapsed * 0.22) * 0.035;
    this.moon.mouth.scale.y =
      elapsed < this.moonSpeakerUntil ? 0.5 + Math.abs(Math.sin(elapsed * 10)) * 5 : 1;
    this.cloud.group.position.y = 3 + Math.sin(elapsed * 0.8) * 0.18;
    this.cloud.mouth.scale.y =
      elapsed < this.cloudSpeakerUntil ? 0.6 + Math.abs(Math.sin(elapsed * 12)) * 4 : 1;
    this.premiseProps.group.position.x = (motion.propX + cueMotion.x) * 0.012;
    this.premiseProps.group.position.y =
      3.35 + motion.propY * 0.009 - cueMotion.y * 0.012;
    this.premiseProps.group.rotation.y = motion.propX * 0.002;
    this.premiseProps.group.rotation.z = cueMotion.rotation;
    this.premiseProps.group.scale.set(
      0.68 * cueMotion.scaleX,
      0.68 * cueMotion.scaleY,
      0.68,
    );
    this.stripes.forEach((stripe, index) => {
      stripe.rotation.z =
        (index % 2 === 0 ? 0.08 : -0.08) +
        Math.sin(segmentElapsed * (this.pacing === 'frantic' ? 2.4 : 0.45) + index) *
          motion.graphicPulse *
          0.025;
    });
    this.warningLight.intensity = Math.max(
      Math.floor(elapsed) % 17 === 14 ? Math.max(0, Math.sin(elapsed * 18)) * 2.5 : 0,
      this.pacing === 'interrupted' ? motion.graphicPulse * 1.8 : 0,
      cueMotion.flash * 2.4,
    );
    this.camera.position.copy(this.cameraPosition);
    this.camera.position.x +=
      Math.sin(elapsed * 0.13) * (this.currentCamera === 'CAMERA_WIDE' ? 0.08 : 0.025) +
      motion.cameraX * 0.012;
    this.camera.position.y += motion.cameraY * 0.008;
    this.camera.position.z -= (motion.zoom - 1) * 24;
    this.camera.lookAt(this.cameraTarget);

    this.renderer.setScissorTest(false);
    this.renderer.setClearColor(0x030708, 1);
    this.renderer.clear();
    this.renderer.setViewport(
      Math.round(this.viewport.x * this.renderScale),
      Math.round(this.viewport.y * this.renderScale),
      Math.round(this.viewport.width * this.renderScale),
      Math.round(this.viewport.height * this.renderScale),
    );
    this.renderer.setScissor(
      Math.round(this.viewport.x * this.renderScale),
      Math.round(this.viewport.y * this.renderScale),
      Math.round(this.viewport.width * this.renderScale),
      Math.round(this.viewport.height * this.renderScale),
    );
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
