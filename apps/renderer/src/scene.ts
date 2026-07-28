import * as THREE from 'three';
import type { SegmentPackage } from '@elsewhere-cable/schemas';

const streamWidth = 1280;
const streamHeight = 720;
const programmeViewport = {
  x: 34,
  y: 30,
  width: 880,
  height: 660,
} as const;

interface CharacterRig {
  group: THREE.Group;
  mouth: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  baseY: number;
  phase: number;
  action: CharacterAction;
  actionUntil: number;
}

interface MoonRig {
  group: THREE.Group;
  mouth: THREE.Mesh;
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

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.82, 2, 7),
    createMaterial(options.bodyColor),
  );
  body.position.y = 1.85;
  group.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.22, 0.34, 7),
    createMaterial(options.skinColor),
  );
  neck.position.y = 3.02;
  group.add(neck);

  const head = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.62, 1),
    createMaterial(options.skinColor, 0.9),
  );
  head.scale.set(0.9, 1.08, 0.88);
  head.position.y = 3.68;
  group.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.57, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.55),
    createMaterial(options.hairColor, 0.95),
  );
  hair.position.set(0, 3.98, 0);
  hair.scale.set(0.92, 0.62, 0.9);
  group.add(hair);

  const eyeMaterial = createMaterial(0x182025, 0.5);
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), eyeMaterial);
    eye.position.set(x, 3.76, 0.51);
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
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.2, 1.15, 6),
      createMaterial(options.bodyColor),
    );
    sleeve.position.y = -0.5;
    const hand = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      createMaterial(options.skinColor),
    );
    hand.position.y = -1.12;
    arm.add(sleeve, hand);
    group.add(arm);
    return arm;
  }

  const leftArm = addArm(-1);
  const rightArm = addArm(1);
  group.scale.setScalar(0.92);

  return {
    group,
    mouth,
    leftArm,
    rightArm,
    baseY: group.position.y,
    phase: options.phase,
    action: 'IDLE',
    actionUntil: 0,
  };
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

function createShoppingModel(): THREE.Group {
  const model = new THREE.Group();
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.35, 1.25, 8),
    createMaterial(0x6e315e),
  );
  pedestal.position.set(0, 0.62, 0.2);
  model.add(pedestal);

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
  model.add(button);
  return model;
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
  private readonly sitcomModel = createSitcomModel();
  private readonly lettersModel = createLettersModel();
  private readonly desk = createDesk();
  private readonly wallMaterial = createMaterial(0x315b59, 1);
  private readonly floorMaterial = createMaterial(0x132527, 0.9);
  private readonly stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x89dfc2 });
  private readonly warningLight: THREE.PointLight;
  private readonly characterIds = new Map<string, number>();
  private activeSpeaker = 0;
  private activeSpeakerUntil = 0;
  private moonSpeakerUntil = 0;
  private currentCamera: CameraName = 'CAMERA_WIDE';
  private cameraPosition = new THREE.Vector3(0, 4.2, 12.8);
  private cameraTarget = new THREE.Vector3(0, 2.15, 0);
  private profile = 'public_access';

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
      this.scene.add(stripe);
    }

    this.scene.add(
      this.desk,
      this.dreamModel,
      this.newsModel,
      this.shoppingModel,
      this.moon.group,
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
    this.profile = segment.programme.format;
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
    this.shoppingModel.visible = false;
    this.moon.group.visible = false;
    this.sitcomModel.visible = false;
    this.lettersModel.visible = false;
    this.characters.forEach((character, index) => {
      character.group.visible = true;
      character.group.position.x = index === 0 ? -2.35 : 2.4;
      character.group.position.y = index === 0 ? 0 : -0.08;
      character.group.position.z = -0.4;
      character.baseY = character.group.position.y;
      character.group.rotation.set(0, 0, 0);
      character.group.scale.setScalar(index === 0 ? 0.92 : 0.86);
      character.action = 'IDLE';
      character.actionUntil = 0;
    });

    const premise = segment.programme.premise.toLowerCase();
    switch (segment.programme.format) {
      case 'news':
        this.applyPalette(0x132a43, 0x08121e, 0xdb3d4b);
        this.desk.visible = true;
        this.newsModel.visible = true;
        break;
      case 'shopping':
      case 'advert':
        this.applyPalette(0x54204e, 0x1b0b22, 0xf3c858);
        this.shoppingModel.visible = true;
        this.characters[0]!.group.position.x = -3.05;
        this.characters[1]!.group.position.x = 3.05;
        break;
      case 'sitcom':
        this.applyPalette(0x74513f, 0x2b1a1d, 0xf3b56b);
        this.sitcomModel.visible = true;
        this.characters[0]!.group.position.x = -1.55;
        this.characters[1]!.group.position.x = 1.6;
        this.characters.forEach((character) => {
          character.group.position.z = 0.25;
        });
        break;
      case 'ident':
        this.applyPalette(0x172743, 0x07101f, 0x9bcde2);
        this.moon.group.visible = true;
        this.characters[0]!.group.visible = false;
        this.characters[1]!.group.position.x = 3.15;
        this.characters[1]!.group.scale.setScalar(0.6);
        break;
      case 'emergency':
        this.applyPalette(0x42131a, 0x150407, 0xff3a42);
        this.desk.visible = true;
        break;
      case 'public_access':
      default:
        this.applyPalette(0x315b59, 0x132527, 0x89dfc2);
        this.desk.visible = true;
        if (premise.includes('dream')) {
          this.dreamModel.visible = true;
        } else {
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
    this.shoppingModel.rotation.y = Math.sin(elapsed * 0.85) * 0.18;
    this.lettersModel.position.y = Math.sin(elapsed * 0.7) * 0.025;
    this.moon.group.rotation.z = Math.sin(elapsed * 0.22) * 0.035;
    this.moon.mouth.scale.y =
      elapsed < this.moonSpeakerUntil ? 0.5 + Math.abs(Math.sin(elapsed * 10)) * 5 : 1;
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
      programmeViewport.x,
      programmeViewport.y,
      programmeViewport.width,
      programmeViewport.height,
    );
    this.renderer.setScissor(
      programmeViewport.x,
      programmeViewport.y,
      programmeViewport.width,
      programmeViewport.height,
    );
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
