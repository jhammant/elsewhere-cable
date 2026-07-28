import * as THREE from 'three';
import type { SegmentPackage } from '@elsewhere-cable/schemas';

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
  head: THREE.Mesh;
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
  group.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.34, 7), skinMaterial);
  neck.position.y = 3.02;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 1), skinMaterial);
  head.scale.set(0.9, 1.08, 0.88);
  head.position.y = 3.68;
  group.add(head);

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
    head,
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
];

const characterHeads: THREE.BufferGeometry[] = [
  new THREE.DodecahedronGeometry(0.62, 1),
  new THREE.BoxGeometry(1.05, 1.05, 0.92, 2, 2, 1),
  new THREE.SphereGeometry(0.64, 10, 7),
  new THREE.ConeGeometry(0.67, 1.25, 8),
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
): void {
  const variant = stableHash(`${programmeId}:${characterId}`);
  character.body.geometry = characterBodies[(variant + index) % characterBodies.length]!;
  character.head.geometry = characterHeads[((variant >>> 3) + index * 2) % characterHeads.length]!;
  character.bodyMaterial.color.setHex(bodyColours[(variant >>> 5) % bodyColours.length]!);
  character.skinMaterial.color.setHex(skinColours[(variant >>> 8) % skinColours.length]!);
  character.hairMaterial.color.setHex(hairColours[(variant >>> 11) % hairColours.length]!);

  const width = 0.78 + ((variant >>> 14) % 6) * 0.065;
  const height = 0.78 + ((variant >>> 18) % 7) * 0.055;
  character.group.scale.set(width, height, width);
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
  character.eyes.forEach((eye) => {
    eye.position.z = 0.78;
  });
  character.mouth.position.z = 0.79;
  character.glasses.position.z = 0.21;
  character.hair.visible = variant % 5 !== 0;
  character.hat.visible = variant % 7 === 0 || programmeId.includes('news');
  character.glasses.visible = variant % 4 === 0 || programmeId.includes('bureau');
  character.antenna.visible = variant % 11 === 0 || characterId.includes('buggy');
  character.group.position.x = index === 0 ? -2.35 : 2.4;
  character.group.position.y = index === 0 ? 0 : -0.08;
  character.group.position.z = -0.4;
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
  private viewport: ProgrammeViewport = { ...defaultProgrammeViewport };
  private segmentStartedAt = 0;

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
    );

    const presenter = createCharacter({
      bodyColor: 0xa5374d,
      skinColor: 0xc98d6a,
      hairColor: 0x261c24,
      x: -2.3,
      phase: 0,
    });
    const official = createCharacter({
      bodyColor: 0x506da0,
      skinColor: 0xa76d4d,
      hairColor: 0x18222c,
      x: 2.4,
      phase: 2.1,
    });
    official.group.scale.setScalar(0.86);
    official.group.position.y = -0.08;
    this.characters = [presenter, official];
    this.scene.add(presenter.group, official.group);

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
    this.segmentStartedAt = this.clock.getElapsedTime();
    this.profile = segment.programme.format;
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
    this.stripes.forEach((stripe) => {
      stripe.visible = false;
    });
    this.characters.forEach((character, index) => {
      character.group.visible = true;
      character.group.rotation.set(0, 0, 0);
      character.action = 'IDLE';
      character.actionUntil = 0;
      const characterId =
        [...this.characterIds.entries()].find((entry) => entry[1] === index)?.[0] ??
        `${segment.programme.id}_background_${index}`;
      configureCharacter(character, characterId, segment.programme.id, index);
    });

    const premise = segment.programme.premise.toLowerCase();
    switch (segment.programme.format) {
      case 'news':
        this.useWideViewport();
        this.applyPalette(0x132a43, 0x08121e, 0xdb3d4b);
        this.desk.visible = true;
        this.newsModel.visible = true;
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
        this.shoppingModel.group.visible = true;
        if (premise.includes('doorbell')) {
          this.shoppingModel.doorbell.visible = true;
        } else {
          this.shoppingModel.mug.visible = true;
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
        this.moon.group.visible = true;
        this.cloud.group.visible = true;
        this.characters.forEach((character) => {
          character.group.visible = false;
        });
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
        } else {
          this.applyPalette(0x514735, 0x211c16, 0xd8b272);
          this.lettersModel.visible = true;
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
    const displayScale = Math.min(window.devicePixelRatio, 1.25);
    if (bounds.width > 0 && bounds.height > 0) {
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
    }
    this.renderer.setPixelRatio(displayScale);
    this.renderer.setSize(streamWidth, streamHeight, false);
  };

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
        character.baseY + Math.sin(elapsed * 1.2 + character.phase) * 0.028;
      character.group.rotation.y = Math.sin(elapsed * 0.45 + character.phase) * 0.035;
      character.group.rotation.z =
        character.action === 'REACTION_CONFUSED' && elapsed < character.actionUntil
          ? Math.sin(elapsed * 3) * 0.12
          : character.action === 'REACTION_SHOCKED' && elapsed < character.actionUntil
            ? Math.sin(elapsed * 18) * 0.025
            : 0;
      character.leftArm.rotation.z =
        character.action === 'REACTION_ANGRY' && elapsed < character.actionUntil
          ? -0.8
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
    this.dreamModel.position.y = 1.72 + Math.sin(elapsed * 0.8) * 0.025;
    this.newsModel.rotation.z = Math.sin(elapsed * 0.35) * 0.025;
    this.shoppingModel.group.rotation.y = Math.sin(elapsed * 0.85) * 0.18;
    this.shoppingModel.doorbell.scale.setScalar(1 + Math.max(0, Math.sin(elapsed * 3)) * 0.025);
    this.shoppingModel.mug.position.y = -Math.min(0.28, (elapsed - this.segmentStartedAt) * 0.009);
    this.lettersModel.position.y = Math.sin(elapsed * 0.7) * 0.025;
    this.moon.group.rotation.z = Math.sin(elapsed * 0.22) * 0.035;
    this.moon.mouth.scale.y =
      elapsed < this.moonSpeakerUntil ? 0.5 + Math.abs(Math.sin(elapsed * 10)) * 5 : 1;
    this.cloud.group.position.y = 3 + Math.sin(elapsed * 0.8) * 0.18;
    this.cloud.mouth.scale.y =
      elapsed < this.cloudSpeakerUntil ? 0.6 + Math.abs(Math.sin(elapsed * 12)) * 4 : 1;
    this.warningLight.intensity =
      Math.floor(elapsed) % 17 === 14 ? Math.max(0, Math.sin(elapsed * 18)) * 2.5 : 0;
    this.camera.position.copy(this.cameraPosition);
    this.camera.position.x +=
      Math.sin(elapsed * 0.13) * (this.currentCamera === 'CAMERA_WIDE' ? 0.08 : 0.025);
    this.camera.lookAt(this.cameraTarget);

    this.renderer.setScissorTest(false);
    this.renderer.setClearColor(0x030708, 1);
    this.renderer.clear();
    this.renderer.setViewport(
      this.viewport.x,
      this.viewport.y,
      this.viewport.width,
      this.viewport.height,
    );
    this.renderer.setScissor(
      this.viewport.x,
      this.viewport.y,
      this.viewport.width,
      this.viewport.height,
    );
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
