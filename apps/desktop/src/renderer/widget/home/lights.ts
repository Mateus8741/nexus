// Luminárias: um modelo pequeno, as luzes three.js que ele aciona e a animação que leva ambos
// ao estado do dispositivo (port de three/lights.js). O "bloom" do original foi trocado por um
// sprite aditivo barato (brilho falso) + emissivo.
import * as THREE from "three";

import { at, box, cyl, mat, sharedGeometry } from "./kit";
import type { PlanLight } from "./plan";

const STOPS: [number, THREE.Color][] = [
  [2200, new THREE.Color("#ff9438")],
  [3000, new THREE.Color("#ffbd7a")],
  [4200, new THREE.Color("#ffe2c2")],
  [6500, new THREE.Color("#dfe9ff")],
];

export function tempToColor(kelvin: number, out = new THREE.Color()): THREE.Color {
  const k = Math.min(6500, Math.max(2200, kelvin));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [k0, c0] = STOPS[i] as [number, THREE.Color];
    const [k1, c1] = STOPS[i + 1] as [number, THREE.Color];
    if (k <= k1) return out.copy(c0).lerp(c1, (k - k0) / (k1 - k0));
  }
  return out.copy((STOPS[STOPS.length - 1] as [number, THREE.Color])[1]);
}

export interface LightLook {
  temp: number;
  color: string | null;
}

export function lightColor(state: LightLook, out = new THREE.Color()): THREE.Color {
  return state.color ? out.set(state.color) : tempToColor(state.temp, out);
}

/** O que o modelo 3D precisa saber de uma lâmpada: saída 0..1 e cor. */
export interface LightVisual extends LightLook {
  level: number;
}

const DARK = "#23262e";

function glowMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: "#8d8f96", roughness: 0.6, emissive: "#000000", emissiveIntensity: 1 });
}

function spot(intensity: number, y: number): THREE.SpotLight {
  const light = new THREE.SpotLight(0xffffff, 0, 0, 1.2, 0.75, 2);
  light.position.set(0, y, 0);
  light.target.position.set(0, y - 1, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512); // original: 1024 — o mapa é estático e o widget é pequeno
  light.shadow.camera.near = 0.15;
  light.shadow.camera.far = 9;
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.03;
  light.shadow.radius = 5;
  light.userData.max = intensity;
  return light;
}

function point(intensity: number, y: number, { shadow = true, distance = 0, x = 0, z = 0 } = {}): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, 0, distance, 2);
  light.position.set(x, y, z);
  if (shadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256); // original: 512
    light.shadow.camera.near = 0.08;
    light.shadow.camera.far = 9;
    light.shadow.bias = -0.003;
    light.shadow.normalBias = 0.03;
    light.shadow.radius = 4;
  }
  light.userData.max = intensity;
  return light;
}

interface Fixture {
  parts: THREE.Mesh[];
  glow: THREE.Mesh[];
  lights: THREE.Light[];
  /** [largura, altura, profundidade, y] da caixa de clique e pivô do modelo. */
  hit: [number, number, number, number];
  /** Tamanho [w, h] do brilho falso e altura dele. */
  halo: [number, number, number];
}

type FixtureBuilder = (cfg: PlanLight, H: number) => Fixture;

const fixtures: Record<string, FixtureBuilder> = {
  ceiling(cfg, H) {
    const y = cfg.y ?? H - 0.14;
    return {
      parts: [at(cyl(0.012, 0.012, H - y - 0.05, mat(DARK), 8), 0, y + 0.05, 0)],
      glow: [at(cyl(0.27, 0.27, 0.055, glowMaterial(), 40), 0, y, 0)],
      lights: [spot(cfg.intensity ?? 20, y - 0.02)],
      hit: [0.75, 0.5, 0.75, y],
      halo: [1.5, 1.5, y - 0.05],
    };
  },

  pendant(cfg, H) {
    const y = cfg.y ?? 1.8;
    const globe = new THREE.Mesh(sharedGeometry("globe", () => new THREE.SphereGeometry(0.17, 24, 16)), glowMaterial());
    globe.position.set(0, y, 0);
    return {
      parts: [at(cyl(0.006, 0.006, H - y - 0.15, mat(DARK), 6), 0, y + 0.15, 0), at(cyl(0.04, 0.05, 0.05, mat(DARK, { rough: 0.4, metal: 0.6 }), 16), 0, y + 0.14, 0)],
      glow: [globe],
      lights: [spot(cfg.intensity ?? 9, y - 0.05)],
      hit: [0.6, 0.7, 0.6, y],
      halo: [1.25, 1.25, y],
    };
  },

  spots(cfg, H) {
    const y = cfg.y ?? H - 0.16;
    const glow = [-0.32, 0, 0.32].map((x) => at(cyl(0.055, 0.045, 0.1, glowMaterial(), 20), x, y - 0.06, 0));
    return {
      parts: [at(box(0.95, 0.03, 0.05, mat(DARK, { rough: 0.5 }), { r: 0.01 }), 0, y + 0.05, 0)],
      glow,
      lights: [spot(cfg.intensity ?? 20, y - 0.08)],
      hit: [1.1, 0.45, 0.5, y],
      halo: [1.6, 0.9, y - 0.06],
    };
  },

  floor(cfg) {
    const shade = cyl(0.14, 0.19, 0.3, glowMaterial(), 32);
    return {
      parts: [at(cyl(0.15, 0.16, 0.025, mat(DARK, { rough: 0.4, metal: 0.5 })), 0, 0, 0), at(cyl(0.011, 0.011, 1.3, mat(DARK, { rough: 0.4, metal: 0.5 }), 8), 0, 0.02, 0)],
      glow: [at(shade, 0, 1.28, 0)],
      lights: [point(cfg.intensity ?? 3.4, 1.46)],
      hit: [0.6, 1.7, 0.6, 0.85],
      halo: [1.4, 1.4, 1.42],
    };
  },

  table(cfg) {
    const y = cfg.y ?? 0.5;
    return {
      parts: [at(cyl(0.065, 0.075, 0.02, mat(DARK, { rough: 0.4, metal: 0.5 })), 0, y, 0), at(cyl(0.01, 0.01, 0.18, mat(DARK, { rough: 0.4, metal: 0.5 }), 8), 0, y + 0.02, 0)],
      glow: [at(cyl(0.085, 0.125, 0.17, glowMaterial(), 28), 0, y + 0.18, 0)],
      // Abajur pequeno: sem mapa de sombra (o raio curto já o contém no cômodo).
      lights: [point(cfg.intensity ?? 1.5, y + 0.3, { shadow: false, distance: 3.4 })],
      hit: [0.5, 0.6, 0.5, y + 0.2],
      halo: [0.75, 0.75, y + 0.26],
    };
  },

  strip(cfg) {
    const y = cfg.y ?? 1;
    const length = cfg.length ?? 1;
    const n = Math.max(1, Math.round(length / 1.0));
    const lights: THREE.Light[] = [];
    for (let i = 0; i < n; i++) {
      const x = -length / 2 + (length / n) * (i + 0.5);
      lights.push(point((cfg.intensity ?? 1.6) / n, y, { shadow: false, distance: 3.2, x, z: 0.05 }));
    }
    return {
      parts: [],
      glow: [at(box(length, 0.022, 0.022, glowMaterial(), { r: 0.008 }), 0, y - 0.011, 0)],
      lights,
      hit: [length + 0.2, 0.4, 0.4, y],
      halo: [length + 0.7, 0.7, y],
    };
  },
};

const OFF_EMISSIVE = new THREE.Color("#5b6b93");
const BODY = new THREE.Color("#8d8f96");

let haloTexture: THREE.CanvasTexture | null = null;
function getHaloTexture(): THREE.CanvasTexture {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.2, "rgba(255,255,255,0.4)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  haloTexture = new THREE.CanvasTexture(canvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

export function disposeLightTextures(): void {
  haloTexture?.dispose();
  haloTexture = null;
}

export class LightUnit {
  readonly cfg: PlanLight;
  readonly id: string;
  readonly group = new THREE.Group();
  readonly hit: THREE.Mesh;
  hoverGoal = 0;

  private readonly model = new THREE.Group();
  private readonly pivotY: number;
  private readonly glow: THREE.MeshStandardMaterial[];
  private readonly lights: THREE.Light[];
  private readonly halo: THREE.SpriteMaterial;
  private level = 0; // saída suavizada 0..1
  private goal = 0;
  private readonly color = new THREE.Color("#ffbd7a");
  private readonly goalColor = this.color.clone();
  private hover = 0;
  private pulse = 0;
  private delay = 0;

  constructor(cfg: PlanLight, H: number) {
    this.cfg = cfg;
    this.id = cfg.id;
    const f = (fixtures[cfg.type] as FixtureBuilder)(cfg, H);

    this.group.position.set(cfg.pos[0], 0, cfg.pos[1]);
    this.group.rotation.y = THREE.MathUtils.degToRad(cfg.rot || 0);

    this.pivotY = f.hit[3];
    this.model.position.y = this.pivotY;
    for (const m of [...f.parts, ...f.glow]) {
      m.position.y -= this.pivotY;
      m.castShadow = false;
      m.receiveShadow = false;
      this.model.add(m);
    }
    this.group.add(this.model);

    this.glow = f.glow.map((m) => m.material as THREE.MeshStandardMaterial);
    this.lights = f.lights;
    for (const l of this.lights) {
      this.group.add(l);
      const target = (l as THREE.SpotLight).target;
      if (target) this.group.add(target);
    }

    // Brilho falso no lugar do bloom: sprite aditivo, testado contra a profundidade (paredes o ocultam).
    this.halo = new THREE.SpriteMaterial({ map: getHaloTexture(), color: this.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const sprite = new THREE.Sprite(this.halo);
    sprite.scale.set(f.halo[0], f.halo[1], 1);
    sprite.position.y = f.halo[2];
    sprite.raycast = () => undefined;
    this.group.add(sprite);

    const [hw, hh, hd, hy] = f.hit;
    this.hit = new THREE.Mesh(sharedGeometry(`hit|${hw}|${hh}|${hd}`, () => new THREE.BoxGeometry(hw, hh, hd)), new THREE.MeshBasicMaterial());
    this.hit.position.y = hy;
    this.hit.visible = false;
    this.hit.userData = { kind: "light", id: cfg.id };
    this.group.add(this.hit);

    this.write();
  }

  /** Ponto usado pelo tooltip. */
  anchor(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, this.pivotY + 0.25, 0).applyMatrix4(this.group.matrixWorld);
  }

  apply(visual: LightVisual, { instant = false, delay = 0 } = {}): void {
    this.goal = visual.level;
    lightColor(visual, this.goalColor);
    this.delay = delay;
    if (instant) {
      this.level = this.goal;
      this.color.copy(this.goalColor);
      this.write();
    } else if (this.level < 0.01) {
      this.color.copy(this.goalColor); // nada visível ainda: não precisa fazer fade da cor
    }
  }

  bump(): void {
    this.pulse = 1;
  }

  /** Reinicia a saída (usado na animação de entrada). */
  zero(): void {
    this.level = 0;
    this.write();
  }

  /** Devolve true enquanto ainda há algo animando (o loop decide se pede outro quadro). */
  update(dt: number): boolean {
    if (this.delay > 0) {
      this.delay -= dt;
      return true;
    }
    const k = 1 - Math.exp(-dt * (this.goal > this.level ? 7 : 5));
    const dl = this.goal - this.level;
    const dh = this.hoverGoal - this.hover;
    const dc = Math.abs(this.color.r - this.goalColor.r) + Math.abs(this.color.g - this.goalColor.g) + Math.abs(this.color.b - this.goalColor.b);
    const moving = Math.abs(dl) > 0.002 || Math.abs(dh) > 0.004 || dc > 0.004 || this.pulse > 0.004;
    if (!moving) {
      if (this.level !== this.goal || this.hover !== this.hoverGoal || this.pulse !== 0) {
        this.level = this.goal;
        this.hover = this.hoverGoal;
        this.pulse = 0;
        this.color.copy(this.goalColor);
        this.write();
        return true;
      }
      return false;
    }
    this.level += dl * k;
    this.hover += dh * (1 - Math.exp(-dt * 14));
    this.pulse *= Math.exp(-dt * 7);
    this.color.lerp(this.goalColor, 1 - Math.exp(-dt * 6));
    this.write();
    return true;
  }

  private write(): void {
    const out = Math.pow(this.level, 1.5);
    for (const l of this.lights) {
      l.intensity = (l.userData.max as number) * out;
      l.color.copy(this.color);
    }
    // Corpos ficam levemente legíveis desligados e quentes o bastante para "brilhar" ligados.
    const e = this.level > 0.001 ? 0.8 + 1.7 * Math.pow(this.level, 0.7) : 0;
    for (const m of this.glow) {
      m.emissive.copy(this.color);
      m.emissiveIntensity = e + this.hover * 0.5;
      if (this.level < 0.001) m.emissive.copy(OFF_EMISSIVE);
      m.color.copy(BODY).lerp(this.color, Math.min(1, this.level * 2));
    }
    this.halo.color.copy(this.color);
    this.halo.opacity = Math.min(0.85, Math.pow(this.level, 0.8) * 0.8 + this.hover * 0.08 * (this.level > 0.001 ? 1 : 0));
    const s = 1 + this.hover * 0.14 + Math.sin(this.pulse * Math.PI) * 0.22;
    this.model.scale.setScalar(s);
  }
}
