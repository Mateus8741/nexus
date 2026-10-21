// Palco 3D: renderer, câmera, picking e loop de animação (port de three/world.js).
//
// Diferenças deliberadas em relação ao original, todas por desempenho (o widget vive o dia todo):
//  - sem EffectComposer/bloom: o brilho é emissivo + sprite aditivo (ver lights.ts);
//  - sem antialias no canvas, pixelRatio <= 1.5 e teto de 30 quadros por segundo;
//  - renderiza sob demanda (só enquanto algo anima ou mudou) e para quando o documento fica oculto;
//  - mapas de sombra estáticos (autoUpdate = false), atualizados só nos primeiros quadros;
//  - teardown completo: geometrias, materiais, texturas, listeners e contexto WebGL.
import * as THREE from "three";

import { ACUnit, type AcVisual } from "./ac";
import { buildFurniture } from "./furniture";
import { buildHouse } from "./house";
import { disposeKit } from "./kit";
import { disposeLightTextures, LightUnit, type LightVisual } from "./lights";
import type { Plan } from "./plan";

export const STAGE_BG = "#0a0e1a";

const rad = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const ORBIT_AZ = 40; // graus de liberdade para cada lado da vista padrão da planta
const EL_MIN = 26;
const EL_MAX = 70;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.2;
const FRAME_MS = 1000 / 30;
const MAX_PIXEL_RATIO = 1.5;

export type FocusTarget = { kind: "room"; id: string } | { kind: "ac"; id: string } | null;
export type PickTarget = { kind: "light" | "ac" | "room"; id: string };
export type HoverHit = (PickTarget & { x: number; y: number }) | null;

export interface WorldHooks {
  onHover(hit: HoverHit): void;
  onPick(target: PickTarget | null): void;
}

export interface World {
  setLight(id: string, visual: LightVisual, opts?: { instant?: boolean; delay?: number }): void;
  setAC(id: string, visual: AcVisual, opts?: { instant?: boolean }): void;
  /** Pede quadros depois de uma mudança de estado. */
  wake(frames?: number): void;
  bump(id: string): void;
  focus(target: FocusTarget): void;
  intro(): void;
  setInsets(top: number, bottom: number): void;
  resize(): void;
  setRunning(on: boolean): void;
  dispose(): void;
}

const WALL_SIDE: Record<string, number> = { north: -14, west: 14, south: 0, east: 0 };

export function createWorld(canvas: HTMLCanvasElement, plan: Plan, { onHover, onPick }: WorldHooks): World {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "default" });
  const pixelRatio = (): number => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  renderer.setPixelRatio(pixelRatio());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // o modelo é estático: mapas de sombra são desenhados uma vez

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STAGE_BG);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.5, 120);

  const { minX, minZ, maxX, maxZ } = plan.bounds;
  const H = plan.wallHeight;
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const span = Math.max(maxX - minX, maxZ - minZ);

  const baseAz = plan.camera.azimuth;
  const camDir = new THREE.Vector3(Math.sin(rad(baseAz)), 0, Math.cos(rad(baseAz)));

  /* ---------- conteúdo ---------- */

  const house = buildHouse(plan, camDir);
  scene.add(house.group);
  scene.add(buildFurniture(plan.furniture));

  const lights = new Map<string, LightUnit>();
  for (const cfg of plan.lights) {
    const unit = new LightUnit(cfg, H);
    lights.set(cfg.id, unit);
    scene.add(unit.group);
  }
  const acs = new Map<string, ACUnit>();
  for (const cfg of plan.acs) {
    const unit = new ACUnit(cfg);
    acs.set(cfg.id, unit);
    scene.add(unit.group);
  }
  const hitTargets: THREE.Object3D[] = [...[...lights.values()].map((u) => u.hit), ...[...acs.values()].map((u) => u.hit), ...house.floors];

  // Ambiente noturno: o bastante para ler o modelo com todas as lâmpadas apagadas.
  scene.add(new THREE.HemisphereLight(0x8ea6ff, 0x0b0e17, 0.42));
  const moon = new THREE.DirectionalLight(0xa9c0ff, 0.6);
  // Alta e vinda do lado do observador, para as faces visíveis continuarem legíveis.
  moon.position.copy(center).add(new THREE.Vector3(camDir.x * 3.2 + 1.5, 10, camDir.z * 3.2 - 1.5));
  moon.target.position.copy(center);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024); // original: 2048
  const sc = moon.shadow.camera;
  sc.left = sc.bottom = -span * 0.85;
  sc.right = sc.top = span * 0.85;
  sc.near = 1;
  sc.far = 30;
  moon.shadow.bias = -0.0008;
  moon.shadow.normalBias = 0.04;
  moon.shadow.radius = 4;
  scene.add(moon, moon.target);

  /* ---------- rig de câmera ---------- */

  const rig = {
    az: baseAz,
    el: plan.camera.elevation,
    dist: 30,
    target: center.clone(),
    goal: { az: baseAz, el: plan.camera.elevation, dist: 30, target: center.clone() },
    zoom: 1,
    focus: null as FocusTarget,
  };
  let width = 1;
  let height = 1;
  let topInset = 0;
  let bottomInset = 0;

  const v = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  function basis(az: number, el: number): void {
    const a = rad(az);
    const e = rad(el);
    fwd.set(-Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e));
    right.set(Math.cos(a), 0, -Math.sin(a));
    up.crossVectors(right, fwd);
  }

  // Menor distância em que `box` cabe na parte útil do viewport.
  function fitDistance(boxToFit: THREE.Box3, az: number, el: number, fill: number): { dist: number; center: THREE.Vector3 } {
    basis(az, el);
    const c = boxToFit.getCenter(new THREE.Vector3());
    const usableH = Math.max(0.3, (height - topInset - bottomInset) / height);
    const tanV = Math.tan(rad(camera.fov / 2)) * fill * usableH;
    const tanH = Math.tan(rad(camera.fov / 2)) * camera.aspect * fill;
    let dist = 0;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? boxToFit.max.x : boxToFit.min.x, i & 2 ? boxToFit.max.y : boxToFit.min.y, i & 4 ? boxToFit.max.z : boxToFit.min.z).sub(c);
      const depth = v.dot(fwd);
      dist = Math.max(dist, Math.abs(v.dot(right)) / tanH - depth, Math.abs(v.dot(up)) / tanV - depth);
    }
    return { dist, center: c };
  }

  function frameGoal(): void {
    const f = rig.focus;
    let boxToFit: THREE.Box3;
    let fill = 0.96;
    const room = f?.kind === "room" ? plan.rooms.find((x) => x.id === f.id) : undefined;
    const unit = f?.kind === "ac" ? acs.get(f.id) : undefined;
    if (room) {
      boxToFit = new THREE.Box3(new THREE.Vector3(room.x, 0, room.z), new THREE.Vector3(room.x + room.w, H * 0.75, room.z + room.d));
      fill = 0.84;
    } else if (unit) {
      const p = unit.group.position;
      const out = new THREE.Vector3(0, 0, 1).applyQuaternion(unit.group.quaternion);
      boxToFit = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(p.x + out.x * 1.3, 1.25, p.z + out.z * 1.3), new THREE.Vector3(3.6, 2.6, 3.6));
      fill = 0.92;
    } else {
      boxToFit = new THREE.Box3(new THREE.Vector3(minX, 0, minZ), new THREE.Vector3(maxX, H * 0.8, maxZ));
    }
    const { dist, center: c } = fitDistance(boxToFit, rig.goal.az, rig.goal.el, fill);
    rig.goal.dist = dist * rig.zoom;
    rig.goal.target.copy(c);
  }

  function updateRig(dt: number, instant = false): boolean {
    const k = instant || reduceMotion.matches ? 1 : 1 - Math.exp(-dt * 5.5);
    const g = rig.goal;
    const delta = Math.abs(g.az - rig.az) + Math.abs(g.el - rig.el) + Math.abs(g.dist - rig.dist) * 2 + rig.target.distanceTo(g.target) * 4;
    rig.az += (g.az - rig.az) * k;
    rig.el += (g.el - rig.el) * k;
    rig.dist += (g.dist - rig.dist) * k;
    rig.target.lerp(g.target, k);
    basis(rig.az, rig.el);
    camera.position.copy(rig.target).addScaledVector(fwd, -rig.dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(rig.target);
    return delta > 0.002;
  }

  /* ---------- estado ---------- */

  const lightVisuals = new Map<string, LightVisual>();
  const acVisuals = new Map<string, AcVisual>();

  /* ---------- picking ---------- */

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: PickTarget | null = null;
  let drag: { x: number; y: number; az: number; el: number; moved: boolean } | null = null;

  function pick(ev: PointerEvent): PickTarget | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    if (!hits.length) return null;
    // Dispositivos têm prioridade sobre o piso em que estão.
    const device = hits.find((h) => (h.object.userData as PickTarget).kind !== "room");
    return ((device ?? hits[0])?.object.userData as PickTarget | undefined) ?? null;
  }

  function unitOf(t: PickTarget | null): LightUnit | ACUnit | undefined {
    return t?.kind === "light" ? lights.get(t.id) : t?.kind === "ac" ? acs.get(t.id) : undefined;
  }

  function screenAnchor(t: PickTarget): { x: number; y: number } {
    const unit = unitOf(t);
    if (!unit) return { x: 0, y: 0 };
    unit.anchor(v).project(camera);
    return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
  }

  function setHover(t: PickTarget | null): void {
    const same = hovered?.kind === t?.kind && hovered?.id === t?.id;
    if (same) return;
    const prev = unitOf(hovered);
    if (prev) prev.hoverGoal = 0;
    hovered = t && t.kind !== "room" ? t : null;
    const next = unitOf(hovered);
    if (next) next.hoverGoal = 1;
    canvas.style.cursor = hovered ? "pointer" : drag?.moved ? "grabbing" : "grab";
    onHover(hovered ? { ...hovered, ...screenAnchor(hovered) } : null);
    wake();
  }

  // Dois dedos fazem pinça (zoom), como a roda do mouse.
  const fingers = new Map<number, { x: number; y: number }>();
  let pinch: { spread: number; zoom: number } | null = null;
  const spread = (): number => {
    const [a, b] = [...fingers.values()];
    return a && b ? Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) : 1;
  };

  const listeners: [string, (ev: never) => void, AddEventListenerOptions?][] = [];
  const on = <E extends Event>(type: string, fn: (ev: E) => void, opts?: AddEventListenerOptions): void => {
    canvas.addEventListener(type, fn as EventListener, opts);
    listeners.push([type, fn as (ev: never) => void, opts]);
  };

  on<PointerEvent>("pointerdown", (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (fingers.size === 2) {
      pinch = { spread: spread(), zoom: rig.zoom };
      drag = null;
      setHover(null);
      return;
    }
    if (fingers.size > 2) return;
    drag = { x: ev.clientX, y: ev.clientY, az: rig.goal.az, el: rig.goal.el, moved: false };
  });
  on<PointerEvent>("pointermove", (ev) => {
    if (fingers.has(ev.pointerId)) fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch) {
      if (fingers.size >= 2) {
        rig.zoom = clamp((pinch.zoom * pinch.spread) / spread(), ZOOM_MIN, ZOOM_MAX);
        frameGoal();
        wake();
      }
      return;
    }
    if (drag) {
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        setHover(null);
        canvas.style.cursor = "grabbing";
      }
      if (drag.moved) {
        rig.goal.az = clamp(drag.az - dx * 0.35, baseAz - ORBIT_AZ, baseAz + ORBIT_AZ);
        rig.goal.el = clamp(drag.el + dy * 0.3, EL_MIN, EL_MAX);
        frameGoal();
        wake();
      }
      return;
    }
    setHover(pick(ev));
  });
  on<PointerEvent>("pointerup", (ev) => {
    fingers.delete(ev.pointerId);
    if (pinch) {
      if (!fingers.size) pinch = null; // soltar depois de uma pinça não seleciona nada
      return;
    }
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    canvas.style.cursor = "grab";
    if (wasDrag) return;
    const t = pick(ev);
    if (!t) {
      onPick(null);
      return;
    }
    if (t.kind === "light") lights.get(t.id)?.bump();
    onPick(t);
    wake();
  });
  on<PointerEvent>("pointercancel", (ev) => {
    fingers.delete(ev.pointerId);
    if (!fingers.size) pinch = null;
    drag = null;
  });
  on<PointerEvent>("pointerleave", () => {
    if (!drag) setHover(null);
  });
  on<WheelEvent>(
    "wheel",
    (ev) => {
      ev.preventDefault();
      rig.zoom = clamp(rig.zoom * Math.exp(ev.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX);
      frameGoal();
      wake();
    },
    { passive: false },
  );
  canvas.style.cursor = "grab";

  /* ---------- loop ---------- */

  let raf = 0;
  let last = 0;
  let awake = 0; // quadros ainda devidos depois da última mudança
  let running = false;
  let shadowFrames = 3;

  function wake(frames = 2): void {
    awake = Math.max(awake, frames);
    if (running && !raf && !document.hidden) {
      last = performance.now() - FRAME_MS;
      raf = requestAnimationFrame(frame);
    }
  }

  function frame(now: number): void {
    raf = 0;
    if (!running || document.hidden) return;
    if (now - last < FRAME_MS - 1) {
      raf = requestAnimationFrame(frame); // teto de 30 fps: espera o próximo vsync
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let active = updateRig(dt);
    for (const unit of lights.values()) active = unit.update(dt) || active;
    for (const unit of acs.values()) active = unit.update(dt) || active;
    if (shadowFrames > 0) {
      renderer.shadowMap.needsUpdate = true;
      shadowFrames--;
      active = true;
    }
    if (active || awake > 0) {
      renderer.render(scene, camera);
      awake = Math.max(0, awake - 1);
      if (hovered && active) onHover({ ...hovered, ...screenAnchor(hovered) });
    }
    if (running && (active || awake > 0)) raf = requestAnimationFrame(frame);
  }

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    width = r.width;
    height = r.height;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Centraliza o modelo entre o cabeçalho e o painel deslocando a janela de projeção.
    camera.setViewOffset(width, height, 0, -(topInset - bottomInset) / 2, width, height);
    camera.updateProjectionMatrix();
    frameGoal();
    wake(3);
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);

  const onVisibility = (): void => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden) wake(3);
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onMotionChange = (): void => {
    for (const unit of acs.values()) unit.still = reduceMotion.matches;
    wake();
  };
  reduceMotion.addEventListener("change", onMotionChange);
  for (const unit of acs.values()) unit.still = reduceMotion.matches;

  const world: World = {
    setLight(id, visual, opts = {}) {
      lightVisuals.set(id, visual);
      lights.get(id)?.apply(visual, opts);
      wake();
    },

    setAC(id, visual, opts = {}) {
      acVisuals.set(id, visual);
      acs.get(id)?.apply(visual, opts);
      wake();
    },

    wake,

    bump(id) {
      lights.get(id)?.bump();
      wake();
    },

    focus(next) {
      rig.focus = next;
      rig.zoom = 1;
      const unit = next?.kind === "ac" ? acs.get(next.id) : undefined;
      rig.goal.az = baseAz + (unit ? (WALL_SIDE[unit.cfg.wall] ?? 0) : 0);
      rig.goal.el = next?.kind === "ac" ? 30 : plan.camera.elevation;
      frameGoal();
      wake();
    },

    // Varredura de câmera + acendimento escalonado, tocada sempre que o painel aparece.
    intro() {
      if (reduceMotion.matches) {
        for (const [id, vis] of lightVisuals) lights.get(id)?.apply(vis, { instant: true });
        for (const [id, vis] of acVisuals) acs.get(id)?.apply(vis, { instant: true });
        frameGoal();
        updateRig(0, true);
        wake(3);
        return;
      }
      for (const [id, vis] of lightVisuals) lights.get(id)?.apply(vis, { instant: true });
      for (const [id, vis] of acVisuals) acs.get(id)?.apply(vis, { instant: true });
      for (const unit of lights.values()) unit.zero();
      for (const unit of acs.values()) unit.zero();
      let i = 0;
      for (const [id, vis] of lightVisuals) lights.get(id)?.apply(vis, { delay: 0.25 + i++ * 0.06 });
      for (const [id, vis] of acVisuals) acs.get(id)?.apply(vis);
      frameGoal();
      rig.az = rig.goal.az - 16;
      rig.el = rig.goal.el + 9;
      rig.dist = rig.goal.dist * 1.28;
      rig.target.copy(rig.goal.target);
      wake(4);
    },

    setInsets(top, bottom) {
      topInset = top;
      bottomInset = bottom;
      resize();
    },

    resize,

    setRunning(on) {
      running = on;
      if (on) wake(4);
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },

    dispose() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", onMotionChange);
      for (const [type, fn, opts] of listeners) canvas.removeEventListener(type, fn as EventListener, opts);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      disposeKit();
      disposeLightTextures();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  resize();
  updateRig(0, true);
  return world;
}
