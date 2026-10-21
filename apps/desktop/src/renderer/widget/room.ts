/**
 * Cena 3D do ambiente (three.js, sem framework): mesmo cenário do dashboard web.
 * Cada cômodo mapeia para lâmpadas reais da cena; `updateRoom` acende/apaga com
 * transição suave e o ar-condicionado ligado solta vento azul.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type RoomId = "living" | "kitchen" | "bedroom" | "dining";

/** Metros. x = direita, y = cima, z = em direção à câmera. Paredes em x=0 e z=0. */
const W = 9;
const D = 7;
const WALL = 2.6;
const T = 0.28;
const WARM = "#ffbf73";
const WOOD = "#6b4430";
const FIT_FOV = 24;
const FIT_ASPECT = 552 / 430;

type V3 = readonly [number, number, number];
type Hole = readonly [number, number, number, number];

interface BulbSpec {
  pos: V3;
  power: number;
  glow: number;
  room: RoomId;
  shadow?: boolean;
  /** Esfera visível (pendentes); abajures usam a cúpula emissiva. */
  bulb?: boolean;
}

const BULBS: readonly BulbSpec[] = [
  { pos: [2.8, WALL - 0.45, 2.9], power: 18, glow: 3.2, room: "kitchen", shadow: true, bulb: true },
  { pos: [7.0, WALL - 0.45, 1.7], power: 18, glow: 3.2, room: "bedroom", bulb: true },
  { pos: [2.65, WALL - 0.45, 6.0], power: 18, glow: 3.2, room: "living", bulb: true },
  { pos: [6.9, WALL - 0.45, 5.0], power: 18, glow: 3.2, room: "dining", bulb: true },
  { pos: [4.3, 1.5, 4.3], power: 11, glow: 2.4, room: "living" },
  { pos: [5.45, 0.88, 0.45], power: 5, glow: 1.3, room: "bedroom" },
  { pos: [8.5, 0.88, 0.45], power: 5, glow: 1.3, room: "bedroom" },
];

/** Cúpulas emissivas (abajures) ligadas ao nível do mesmo cômodo. */
interface ShadeSpec {
  at: V3;
  r: number;
  rTop: number;
  h: number;
  room: RoomId;
}

const SHADES: readonly ShadeSpec[] = [
  { at: [4.3, 1.3, 4.3], r: 0.3, rTop: 0.2, h: 0.38, room: "living" },
  { at: [5.45, 0.66, 0.45], r: 0.17, rTop: 0.11, h: 0.24, room: "bedroom" },
  { at: [8.5, 0.66, 0.45], r: 0.17, rTop: 0.11, h: 0.24, room: "bedroom" },
];

let glowTexture: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function makeFloorTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const plank = size / 9;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 4; j++) {
        const shade = 150 + ((i * 37 + j * 53) % 40);
        ctx.fillStyle = `rgb(${shade + 40},${shade + 4},${shade - 46})`;
        const off = (i % 2) * (size / 8);
        ctx.fillRect(j * (size / 3) - off, i * plank, size / 3, plank);
        ctx.strokeStyle = "rgba(60,30,10,0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(j * (size / 3) - off, i * plank, size / 3, plank);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* ------------------------------------------------------------- construção */

function addBox(
  parent: THREE.Object3D,
  at: V3,
  size: V3,
  color: string,
  radius = 0.05,
  roughness = 0.7,
  cast = true,
): void {
  const [w, h, d] = size;
  const r = Math.max(0.004, Math.min(radius, Math.min(w, h, d) / 2 - 0.002));
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, 4, r),
    new THREE.MeshStandardMaterial({ color, roughness }),
  );
  mesh.position.set(at[0] + w / 2, at[1] + h / 2, at[2] + d / 2);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function addCyl(
  parent: THREE.Object3D,
  at: V3,
  r: number,
  h: number,
  color: string,
  rTop = r,
  material?: THREE.MeshStandardMaterial,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, r, h, 32),
    material ?? new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  mesh.position.set(at[0], at[1] + h / 2, at[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent: THREE.Object3D, pos: V3, r: number, color: string): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.position.set(...pos);
  mesh.castShadow = true;
  parent.add(mesh);
}

function addPlane(
  parent: THREE.Object3D,
  pos: V3,
  size: [number, number],
  material: THREE.Material,
  rotY = 0,
): void {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  mesh.position.set(...pos);
  mesh.rotation.y = rotY;
  parent.add(mesh);
}

function addWall(parent: THREE.Object3D, axis: "x" | "z", holes: readonly Hole[]): void {
  const length = axis === "x" ? W : D;
  const sorted = [...holes].sort((a, b) => a[0] - b[0]);
  const color = axis === "x" ? "#9fa3cc" : "#8a8ec0";
  const frame = "#f1f2fb";
  const at = (along: number, y: number): V3 => (axis === "x" ? [along, y, -T] : [-T, y, along]);
  const dims = (along: number, y: number, thick: number): V3 =>
    axis === "x" ? [along, y, thick] : [thick, y, along];

  const pieces: { a: number; b: number; y0: number; y1: number }[] = [];
  let cursor = -T;
  for (const [a, b, y0, y1] of sorted) {
    pieces.push({ a: cursor, b: a, y0: 0, y1: WALL });
    pieces.push({ a, b, y0: 0, y1: y0 });
    pieces.push({ a, b, y0: y1, y1: WALL });
    cursor = b;
  }
  pieces.push({ a: cursor, b: length, y0: 0, y1: WALL });
  for (const s of pieces) {
    const len = s.b - s.a;
    if (len <= 0.001 || s.y1 - s.y0 <= 0.001) continue;
    addBox(parent, at(s.a, s.y0), dims(len, s.y1 - s.y0, T), color, 0.02, 0.95);
  }

  const glass = new THREE.MeshBasicMaterial({ color: "#27408f" });
  for (const [a, b, y0, y1] of sorted) {
    const mid = (a + b) / 2;
    const glassPos: V3 = axis === "x" ? [mid, (y0 + y1) / 2, -T / 2] : [-T / 2, (y0 + y1) / 2, mid];
    addPlane(parent, glassPos, [b - a, y1 - y0], glass, axis === "x" ? 0 : Math.PI / 2);
    addBox(parent, at(a - 0.05, y0 - 0.05), dims(b - a + 0.1, 0.1, T + 0.04), frame, 0.02);
    addBox(parent, at(a - 0.05, y1 - 0.05), dims(b - a + 0.1, 0.1, T + 0.04), frame, 0.02);
    addBox(parent, at(a - 0.05, y0), dims(0.1, y1 - y0, T + 0.04), frame, 0.02);
    addBox(parent, at(b - 0.05, y0), dims(0.1, y1 - y0, T + 0.04), frame, 0.02);
    addBox(parent, at(mid - 0.03, y0), dims(0.06, y1 - y0, T + 0.04), frame, 0.02);
    addBox(parent, at(a, (y0 + y1) / 2 - 0.03), dims(b - a, 0.06, T + 0.04), frame, 0.02);
  }
}

function addShell(parent: THREE.Object3D): void {
  addBox(parent, [-T, -0.45, -T], [W + T, 0.45, D + T], "#241f33", 0.06, 0.9);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.55 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0.002, D / 2);
  floor.receiveShadow = true;
  parent.add(floor);

  addWall(parent, "x", [[6.5, 7.9, 1.0, 2.1]]);
  addWall(parent, "z", [
    [1.0, 2.7, 1.0, 2.1],
    [4.3, 6.0, 1.0, 2.1],
  ]);
  addBox(parent, [0, 0, 0], [W, 0.12, 0.04], "#eceefb", 0.015, 0.7, false);
  addBox(parent, [0, 0, 0], [0.04, 0.12, D], "#eceefb", 0.015, 0.7, false);
  addBox(parent, [4.9, 0, 0], [0.16, 1.2, 2.9], "#d7d9f0", 0.04, 0.9);
  addBox(parent, [4.9, 0, 3.4], [W - 4.9, 1.2, 0.16], "#d7d9f0", 0.04, 0.9);
}

function addDiningChair(parent: THREE.Object3D, x: number, z: number, facing: 1 | -1): void {
  const backZ = facing === 1 ? z - 0.03 : z + 0.47;
  addBox(parent, [x, 0.42, z], [0.5, 0.07, 0.5], "#2b2f48", 0.03);
  addBox(parent, [x, 0.42, backZ], [0.5, 0.55, 0.06], "#2b2f48", 0.03);
  for (const [dx, dz] of [
    [0.04, 0.04],
    [0.41, 0.04],
    [0.04, 0.41],
    [0.41, 0.41],
  ] as const) {
    addBox(parent, [x + dx, 0, z + dz], [0.05, 0.42, 0.05], "#1c1f33", 0.015);
  }
}

function addLiving(parent: THREE.Object3D, tv: THREE.MeshStandardMaterial): void {
  const sofa = "#7b8fcf";
  const cushion = "#92a4de";
  addBox(parent, [1.0, 0, 1.5], [3.4, 0.03, 2.9], "#3f4d8c", 0.015, 1);
  addBox(parent, [1.2, 0, 0.1], [2.7, 0.5, 0.55], WOOD, 0.05);
  addBox(parent, [1.55, 1.0, 0.06], [1.9, 1.05, 0.07], "#0d1120", 0.03, 0.3);
  addPlane(parent, [2.5, 1.525, 0.105], [1.8, 0.95], tv);
  addBox(parent, [1.4, 0, 3.75], [2.6, 0.42, 1.0], sofa, 0.14, 0.9);
  addBox(parent, [1.4, 0.2, 4.45], [2.6, 0.85, 0.3], sofa, 0.14, 0.9);
  addBox(parent, [1.3, 0, 3.75], [0.3, 0.62, 1.0], sofa, 0.12, 0.9);
  addBox(parent, [3.7, 0, 3.75], [0.3, 0.62, 1.0], sofa, 0.12, 0.9);
  addBox(parent, [1.62, 0.42, 3.8], [1.0, 0.16, 0.7], cushion, 0.07, 0.9);
  addBox(parent, [2.72, 0.42, 3.8], [1.0, 0.16, 0.7], cushion, 0.07, 0.9);
  addBox(parent, [2.1, 0.32, 2.2], [1.3, 0.07, 0.75], "#c79764", 0.03);
  for (const [x, z] of [
    [2.2, 2.3],
    [3.1, 2.3],
    [2.2, 2.85],
    [3.1, 2.85],
  ] as const) {
    addBox(parent, [x, 0, z], [0.07, 0.32, 0.07], WOOD, 0.02);
  }
  addBox(parent, [2.9, 0.39, 2.4], [0.28, 0.04, 0.2], "#b94a4a", 0.015);
  addBox(parent, [0.45, 0, 1.55], [1.0, 0.4, 1.0], "#cf9d62", 0.14, 0.85);
  addBox(parent, [0.4, 0.15, 1.55], [0.3, 0.85, 1.0], "#cf9d62", 0.14, 0.85);
  addBox(parent, [0.45, 0, 1.45], [1.0, 0.62, 0.22], "#c18f56", 0.1, 0.85);
  addBox(parent, [0.45, 0, 2.43], [1.0, 0.62, 0.22], "#c18f56", 0.1, 0.85);
  addBox(parent, [0.78, 0.4, 1.7], [0.62, 0.14, 0.7], "#e0b27a", 0.06, 0.85);
  addCyl(parent, [0.5, 0, 0.55], 0.22, 0.38, "#32364e");
  addCyl(parent, [0.5, 0.38, 0.55], 0.03, 0.5, "#5a3d2a");
  addSphere(parent, [0.5, 1.05, 0.55], 0.36, "#2f7a4a");
  addSphere(parent, [0.5, 1.5, 0.55], 0.27, "#368a55");
  addBox(parent, [1.6, 0.74, 5.5], [2.1, 0.08, 1.0], "#8b5a3b", 0.03);
  for (const [x, z] of [
    [1.75, 5.62],
    [3.4, 5.62],
    [1.75, 6.35],
    [3.4, 6.35],
  ] as const) {
    addBox(parent, [x, 0, z], [0.09, 0.74, 0.09], "#3a2a22", 0.02);
  }
  addDiningChair(parent, 1.95, 4.85, 1);
  addDiningChair(parent, 2.85, 4.85, 1);
  addDiningChair(parent, 1.95, 6.55, -1);
  addDiningChair(parent, 2.85, 6.55, -1);
  addCyl(parent, [2.65, 0.82, 6.0], 0.12, 0.2, "#e8e1d6", 0.16);
}

function addBedroom(parent: THREE.Object3D): void {
  addBox(parent, [5.8, 0, 0.18], [2.4, 0.4, 2.5], "#4b3326", 0.06);
  addBox(parent, [5.85, 0.4, 0.24], [2.3, 0.28, 2.38], "#e3e5f4", 0.1, 0.95);
  addBox(parent, [5.85, 0.62, 1.15], [2.32, 0.14, 1.5], "#a9acd9", 0.07, 0.95);
  addBox(parent, [6.05, 0.66, 0.34], [0.9, 0.2, 0.5], "#f4f5fc", 0.09, 0.95);
  addBox(parent, [7.05, 0.66, 0.34], [0.9, 0.2, 0.5], "#f4f5fc", 0.09, 0.95);
  addBox(parent, [5.7, 0, 0.06], [2.6, 1.15, 0.12], "#5d4231", 0.05);
  for (const nx of [5.2, 8.25]) addBox(parent, [nx, 0, 0.2], [0.5, 0.5, 0.5], WOOD, 0.05);
  addBox(parent, [5.15, 2.0, 0.04], [1.25, 0.4, 0.28], "#f4f5fb", 0.1, 0.4, false);
  addBox(parent, [5.25, 2.04, 0.3], [1.05, 0.04, 0.03], "#c3c7de", 0.01, 0.7, false);
  for (const [nx] of [[5.45], [8.5]] as const) {
    addCyl(parent, [nx, 0.5, 0.45], 0.07, 0.18, "#d6d9ee");
  }
}

function addOffice(parent: THREE.Object3D): void {
  addBox(parent, [5.7, 0.72, 4.3], [2.3, 0.08, 0.95], "#8b5a3b", 0.03);
  for (const [x, z] of [
    [5.8, 4.4],
    [7.8, 4.4],
    [5.8, 5.1],
    [7.8, 5.1],
  ] as const) {
    addBox(parent, [x, 0, z], [0.07, 0.72, 0.07], "#c9cce0", 0.02);
  }
  addBox(parent, [6.7, 0.8, 4.5], [0.3, 0.2, 0.2], "#aeb3cf", 0.04);
  addBox(parent, [6.1, 0.95, 4.55], [1.2, 0.72, 0.06], "#10141f", 0.025, 0.3);
  addCyl(parent, [6.86, 0.08, 5.5], 0.04, 0.34, "#1d2135");
  addBox(parent, [6.55, 0.42, 5.2], [0.62, 0.12, 0.62], "#232842", 0.06);
  addBox(parent, [6.55, 0.5, 5.75], [0.62, 0.7, 0.1], "#232842", 0.06);
  addCyl(parent, [6.86, 0, 5.5], 0.3, 0.08, "#14172a");
}

/* -------------------------------------------------------------------- API */

interface Bulb {
  spec: BulbSpec;
  light: THREE.PointLight;
  halo: THREE.SpriteMaterial;
  core: THREE.MeshStandardMaterial | null;
}

interface Shade {
  spec: ShadeSpec;
  material: THREE.MeshStandardMaterial;
}

interface RoomState {
  readonly bulbs: Bulb[];
  readonly shades: Shade[];
  readonly levels: Map<unknown, number>;
  readonly lit: Record<RoomId, number>;
  cool: boolean;
}

const states = new WeakMap<Element, RoomState>();

export function buildRoom(): string {
  return `<div class="room" aria-hidden="true"></div>`;
}

/** Cria o renderer 3D dentro de `.room`. Chamar uma vez após inserir o HTML. */
export function mountRoom(root: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // cena estática: sombras renderizadas só nos primeiros quadros
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
  root.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FIT_FOV, FIT_ASPECT, 0.1, 80);
  camera.position.set(17, 13.5, 17.5);
  const target = new THREE.Vector3(W / 2 - 0.1, 0.9, D / 2 - 0.1);

  scene.add(new THREE.HemisphereLight("#8aa0ff", "#2a1d3a", 0.4));
  const moon = new THREE.DirectionalLight("#8fb0ff", 1.1);
  moon.position.set(-5, 11, -6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  moon.shadow.bias = -0.0004;
  scene.add(moon);

  const rig = new THREE.Group();
  rig.position.set(target.x, 0, target.z);
  const content = new THREE.Group();
  content.position.set(-target.x, 0, -target.z);
  rig.add(content);
  scene.add(rig);

  const tvMaterial = new THREE.MeshStandardMaterial({
    color: "#0e1a3c",
    emissive: "#27428f",
    emissiveIntensity: 0.7,
  });
  addShell(content);
  addLiving(content, tvMaterial);
  addBedroom(content);
  addOffice(content);
  addPlane(
    content,
    [6.7, 1.31, 4.59],
    [1.1, 0.62],
    new THREE.MeshStandardMaterial({ color: "#0c1020", roughness: 0.4 }),
  );

  // abajur de piso: base + haste
  addCyl(content, [4.3, 0, 4.3], 0.2, 0.05, "#1d2135");
  addCyl(content, [4.3, 0.05, 4.3], 0.018, 1.35, "#d6d9ee");

  const shades: Shade[] = SHADES.map((spec) => {
    const material = new THREE.MeshStandardMaterial({
      color: "#fff0d2",
      roughness: 0.9,
      emissive: WARM,
      emissiveIntensity: 0.05,
    });
    addCyl(content, spec.at, spec.r, spec.h, "#fff0d2", spec.rTop, material);
    return { spec, material };
  });

  const map = getGlowTexture();
  const bulbs: Bulb[] = BULBS.map((spec) => {
    const light = new THREE.PointLight(WARM, 0, 13, 1.6);
    light.position.set(...spec.pos);
    if (spec.shadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.0008;
    }
    content.add(light);

    let core: THREE.MeshStandardMaterial | null = null;
    if (spec.bulb) {
      core = new THREE.MeshStandardMaterial({
        color: "#fff3d8",
        emissive: WARM,
        emissiveIntensity: 0.15,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 20), core);
      sphere.position.set(...spec.pos);
      content.add(sphere);
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 1.5, 6),
        new THREE.MeshStandardMaterial({ color: "#d6d9ee" }),
      );
      cord.position.set(spec.pos[0], WALL + 0.35, spec.pos[2]);
      content.add(cord);
    }
    const halo = new THREE.SpriteMaterial({
      map,
      color: WARM,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(halo);
    sprite.scale.set(spec.glow, spec.glow, 1);
    sprite.position.set(...spec.pos);
    content.add(sprite);
    return { spec, light, halo, core };
  });

  // sombra suave no vazio
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.35, D * 1.35),
    new THREE.MeshBasicMaterial({
      map,
      color: "#000000",
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(W / 2, -0.6, D / 2);
  content.add(shadow);

  // vento do ar-condicionado
  const wind = Array.from({ length: 5 }, () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color: "#bfe6ff", transparent: true }),
    );
    mesh.visible = false;
    content.add(mesh);
    return mesh;
  });

  const state: RoomState = {
    bulbs,
    shades,
    levels: new Map(),
    lit: { living: 0, kitchen: 0, bedroom: 0, dining: 0 },
    cool: false,
  };
  states.set(root, state);

  const resize = (): void => {
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const half = Math.tan(THREE.MathUtils.degToRad(FIT_FOV / 2)) * 1.05;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half * Math.max(1, FIT_ASPECT / aspect)));
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
  };
  new ResizeObserver(resize).observe(root);
  resize();

  const clock = new THREE.Clock();
  const FRAME_MS = 1000 / 30; // o widget vive o dia todo: 30 quadros bastam
  let lastFrame = 0;
  let shadowFrames = 3;
  const tick = (now = performance.now()): void => {
    requestAnimationFrame(tick);
    if (document.hidden || now - lastFrame < FRAME_MS - 1) return;
    lastFrame = now;
    if (shadowFrames > 0) {
      renderer.shadowMap.needsUpdate = true;
      shadowFrames--;
    }
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    for (const bulb of bulbs) {
      const target = state.lit[bulb.spec.room] > 0 ? 1 : 0;
      const prev = state.levels.get(bulb) ?? 0;
      const level = THREE.MathUtils.damp(prev, target, 4, dt);
      state.levels.set(bulb, level);
      bulb.light.intensity = bulb.spec.power * level;
      bulb.halo.opacity = 0.85 * level;
      if (bulb.core) bulb.core.emissiveIntensity = 0.15 + 3 * level;
    }
    for (const shade of shades) {
      const target = state.lit[shade.spec.room] > 0 ? 1.4 : 0.05;
      shade.material.emissiveIntensity = THREE.MathUtils.damp(
        shade.material.emissiveIntensity,
        target,
        4,
        dt,
      );
    }
    wind.forEach((mesh, i) => {
      mesh.visible = state.cool;
      const p = (t * 0.45 + i * 0.2) % 1;
      mesh.position.set(5.35 + i * 0.22 + Math.sin(p * 6 + i) * 0.05, 1.95 - p * 1.4, 0.45 + p * 0.7);
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.8;
    });
    rig.position.y = Math.sin(t * 0.9) * 0.08;
    renderer.render(scene, camera);
  };
  tick();
}

export function updateRoom(root: Element, lit: Record<RoomId, number>, cool: boolean): void {
  const state = states.get(root);
  if (!state) return;
  Object.assign(state.lit, lit);
  state.cool = cool;
}
