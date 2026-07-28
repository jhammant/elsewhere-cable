import * as THREE from 'three';

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
}

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

export class BroadcastScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly characters: CharacterRig[];
  private readonly dreamModel = createDreamModel();
  private readonly warningLight: THREE.PointLight;

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

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 13), createMaterial(0x315b59, 1));
    wall.position.set(0, 5.4, -4.1);
    this.scene.add(wall);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), createMaterial(0x132527, 0.9));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x89dfc2 });
    for (let index = -2; index <= 2; index += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 10, 0.06), stripeMaterial);
      stripe.position.set(index * 3.5, 5, -4);
      stripe.rotation.z = index % 2 === 0 ? 0.08 : -0.08;
      this.scene.add(stripe);
    }

    this.scene.add(createDesk());
    this.scene.add(this.dreamModel);

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
    const activeSpeaker = Math.floor(elapsed / 4.8) % this.characters.length;

    this.characters.forEach((character, index) => {
      const speech =
        index === activeSpeaker ? Math.abs(Math.sin(elapsed * 11 + character.phase)) : 0;
      character.mouth.scale.y = 0.45 + speech * 4;
      character.group.position.y =
        character.baseY + Math.sin(elapsed * 1.2 + character.phase) * 0.028;
      character.group.rotation.y = Math.sin(elapsed * 0.45 + character.phase) * 0.035;
      character.leftArm.rotation.z = 0.18 + Math.sin(elapsed * 0.8 + character.phase) * 0.08;
      character.rightArm.rotation.z =
        -0.18 - (index === activeSpeaker ? Math.sin(elapsed * 1.9) * 0.3 : 0);
    });

    this.dreamModel.rotation.y = -0.35 + Math.sin(elapsed * 0.45) * 0.12;
    this.dreamModel.position.y = 1.72 + Math.sin(elapsed * 0.8) * 0.025;
    this.warningLight.intensity =
      Math.floor(elapsed) % 17 === 14 ? Math.max(0, Math.sin(elapsed * 18)) * 2.5 : 0;
    this.camera.position.x = Math.sin(elapsed * 0.13) * 0.08;
    this.camera.lookAt(0, 2.15, 0);

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
