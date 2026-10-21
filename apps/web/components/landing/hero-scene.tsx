"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { FrameDriver } from "@/components/scenes/frame-driver";

const WARM = "#ffbf73";
const COOL = "#7fa2ff";
const VIOLET = "#a78bfa";

interface HeroSceneProps {
  /** Pausa o loop de render (fora da viewport / aba oculta). */
  readonly active: boolean;
  readonly reducedMotion: boolean;
}

/** Estado de ponteiro/scroll compartilhado fora do React (sem re-render). */
interface Input {
  x: number;
  y: number;
  scroll: number;
}

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.4)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

function RBox({
  size,
  color,
  radius = 0.06,
  position,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.6,
}: {
  size: readonly [number, number, number];
  color: string;
  radius?: number;
  position?: readonly [number, number, number];
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
}) {
  const [w, h, d] = size;
  const geo = useMemo(
    () => new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, Math.min(w, h, d) / 2 - 0.002)),
    [w, h, d, radius],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={position as [number, number, number] | undefined}>
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        emissive={emissive ?? "#000"}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

/** Halo aditivo que pulsa de acordo com `level` (0–1) lido por ref. */
function Halo({
  level,
  color,
  size,
  position,
}: {
  level: React.RefObject<number>;
  color: string;
  size: number;
  position: readonly [number, number, number];
}) {
  const mat = useRef<THREE.SpriteMaterial>(null);
  const map = useMemo(() => glowTexture(), []);
  useFrame(() => {
    if (mat.current) mat.current.opacity = 0.9 * level.current;
  });
  return (
    <sprite position={position as [number, number, number]} scale={[size, size, 1]}>
      <spriteMaterial
        ref={mat}
        map={map}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

/** Ilha flutuante base: laje arredondada com leve oscilação. */
function Island({
  position,
  phase,
  children,
  tone = "#2a2748",
}: {
  position: readonly [number, number, number];
  phase: number;
  children: React.ReactNode;
  tone?: string;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + phase;
    g.current.position.y = position[1] + Math.sin(t * 0.8) * 0.12;
    g.current.rotation.y = Math.sin(t * 0.35) * 0.06;
  });
  return (
    <group ref={g} position={position as [number, number, number]}>
      <RBox size={[2.2, 0.28, 2.2]} color={tone} radius={0.12} position={[0, -0.14, 0]} />
      <RBox size={[1.9, 0.16, 1.9]} color="#161830" radius={0.08} position={[0, -0.36, 0]} />
      <mesh position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.5, 0.9, 6]} />
        <meshStandardMaterial color="#1a1c38" roughness={0.9} />
      </mesh>
      {children}
    </group>
  );
}

/** Luz que acende e apaga em ciclo. */
function useCycle(period: number, offset: number, reduced: boolean) {
  const level = useRef(reduced ? 1 : 0);
  useFrame(({ clock }, dt) => {
    if (reduced) {
      level.current = 1;
      return;
    }
    const on = (clock.elapsedTime + offset) % period < period * 0.62;
    level.current = THREE.MathUtils.damp(level.current, on ? 1 : 0.08, 3.5, dt);
  });
  return level;
}

function LampIsland({ reduced }: { reduced: boolean }) {
  const level = useCycle(7, 0, reduced);
  const light = useRef<THREE.PointLight>(null);
  const shade = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (light.current) light.current.intensity = 26 * level.current;
    if (shade.current) shade.current.emissiveIntensity = 0.1 + 2.2 * level.current;
  });
  return (
    <Island position={[-3.1, 1.2, 0.4]} phase={0}>
      <RBox size={[1.4, 0.45, 0.7]} color="#6b4430" position={[0, 0.22, 0.2]} />
      <mesh position={[0, 0.5, 0.2]}>
        <cylinderGeometry args={[0.05, 0.08, 0.5, 12]} />
        <meshStandardMaterial color="#d6d9ee" />
      </mesh>
      <mesh position={[0, 0.98, 0.2]}>
        <cylinderGeometry args={[0.2, 0.34, 0.5, 24]} />
        <meshStandardMaterial
          ref={shade}
          color="#fff0d2"
          emissive={WARM}
          emissiveIntensity={0.1}
          roughness={0.9}
        />
      </mesh>
      <pointLight ref={light} position={[0, 1, 0.2]} color={WARM} distance={9} decay={1.6} />
      <Halo level={level} color={WARM} size={3.2} position={[0, 1, 0.2]} />
      <RBox size={[0.9, 0.14, 0.9]} color="#3f4d8c" position={[0, 0.07, -0.5]} radius={0.05} />
    </Island>
  );
}

function ComputerIsland({ reduced }: { reduced: boolean }) {
  const level = useCycle(9, 3, reduced);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (screen.current) screen.current.emissiveIntensity = 0.15 + 1.3 * level.current;
  });
  return (
    <Island position={[3.2, 0.7, -0.6]} phase={2}>
      <RBox size={[1.7, 0.1, 0.9]} color="#8b5a3b" position={[0, 0.35, 0.1]} radius={0.03} />
      <RBox size={[1.3, 0.8, 0.07]} color="#0f1322" position={[0, 0.9, -0.15]} radius={0.03} />
      <mesh position={[0, 0.9, -0.108]}>
        <planeGeometry args={[1.2, 0.7]} />
        <meshStandardMaterial
          ref={screen}
          color="#a7c1ff"
          emissive={COOL}
          emissiveIntensity={0.15}
        />
      </mesh>
      <RBox size={[0.18, 0.4, 0.07]} color="#aeb3cf" position={[0, 0.58, -0.12]} radius={0.02} />
      <Halo level={level} color={COOL} size={3} position={[0, 0.9, 0.2]} />
    </Island>
  );
}

function AcIsland({ reduced }: { reduced: boolean }) {
  const level = useCycle(8, 5, reduced);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.4 + i * 0.17) % 1;
      m.position.set(-0.5 + i * 0.2 + Math.sin(t * 6 + i) * 0.06, 1.25 - t * 1.2, 0.3 + t * 0.9);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(t * Math.PI) * 0.7 * level.current;
    });
  });
  return (
    <Island position={[0.4, 2.6, -2.2]} phase={4}>
      <RBox size={[1.6, 0.46, 0.4]} color="#f4f5fb" position={[0, 1.2, -0.7]} radius={0.12} />
      <RBox size={[1.3, 0.04, 0.05]} color="#9aa0c8" position={[0, 1.04, -0.5]} radius={0.01} />
      <mesh position={[0.62, 1.25, -0.49]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color="#7dffb0" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={`puff-${i}`}
          ref={(m) => {
            puffs.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#bfe6ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      <RBox size={[0.6, 0.35, 0.6]} color="#4b3326" position={[-0.4, 0.17, 0.3]} radius={0.05} />
    </Island>
  );
}

function PlugIsland({ reduced }: { reduced: boolean }) {
  const level = useCycle(6, 2, reduced);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (led.current) led.current.emissiveIntensity = 0.2 + 2.5 * level.current;
  });
  return (
    <Island position={[-0.2, -1.6, 1.8]} phase={6} tone="#2c2450">
      <RBox
        size={[0.9, 0.9, 0.5]}
        color="#f2f3fb"
        position={[0, 0.45, 0]}
        radius={0.16}
        roughness={0.35}
      />
      <mesh position={[0, 0.62, 0.26]}>
        <cylinderGeometry args={[0.16, 0.16, 0.04, 24]} />
        <meshStandardMaterial color="#cfd2ea" />
      </mesh>
      <mesh position={[0, 0.3, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
        <meshStandardMaterial
          ref={led}
          color="#7dffb0"
          emissive="#3dff94"
          emissiveIntensity={0.2}
        />
      </mesh>
      <Halo level={level} color="#5dffa5" size={1.6} position={[0, 0.3, 0.4]} />
    </Island>
  );
}

/** Núcleo central: orbe com anéis. */
function Core() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const orb = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring1.current) ring1.current.rotation.set(t * 0.5, t * 0.3, 0);
    if (ring2.current) ring2.current.rotation.set(Math.PI / 2 + t * 0.2, 0, t * 0.45);
    if (orb.current) orb.current.position.y = 0.4 + Math.sin(t * 1.1) * 0.15;
  });
  return (
    <group ref={orb} position={[0, 0.4, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color="#b9c6ff"
          emissive={VIOLET}
          emissiveIntensity={0.9}
          roughness={0.25}
          metalness={0.2}
          flatShading
        />
      </mesh>
      <mesh ref={ring1}>
        <torusGeometry args={[0.95, 0.012, 8, 96]} />
        <meshBasicMaterial color={COOL} transparent opacity={0.7} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[1.25, 0.01, 8, 96]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.55} />
      </mesh>
      <pointLight color={VIOLET} intensity={14} distance={8} decay={1.8} />
    </group>
  );
}

/** Linhas luminosas ligando o núcleo às ilhas. */
function Links() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const targets: [number, number, number][] = [
      [-3.1, 1.6, 0.4],
      [3.2, 1.2, -0.6],
      [0.4, 3.1, -2.2],
      [-0.2, -1.1, 1.8],
    ];
    for (const t of targets) pts.push(0, 0.4, 0, ...t);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={COOL} transparent opacity={0.28} />
    </lineSegments>
  );
}

/** Poeira / vagalumes quentes. */
function Dust({ count, reduced }: { count: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const { geo, speeds } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 12;
      p[i * 3 + 1] = (Math.random() - 0.5) * 7;
      p[i * 3 + 2] = (Math.random() - 0.5) * 8;
      s[i] = 0.05 + Math.random() * 0.15;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return { geo: g, speeds: s };
  }, [count]);
  const map = useMemo(() => glowTexture(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    if (reduced || !ref.current) return;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) + (speeds[i] ?? 0.1) * dt;
      if (y > 3.6) y = -3.6;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        map={map}
        color={WARM}
        size={0.16}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Rig({
  input,
  reduced,
  children,
}: {
  input: React.RefObject<Input>;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock, size }, dt) => {
    if (!g.current) return;
    const i = input.current;
    // em telas largas o texto ocupa a esquerda: empurra a cena para a direita
    const aspect = size.width / Math.max(size.height, 1);
    const shift = aspect > 1.25 ? Math.min(3.4, (aspect - 1.25) * 6) : 0;
    const scale = aspect < 1 ? 0.5 : aspect < 1.4 ? 0.8 : 1;
    g.current.scale.setScalar(THREE.MathUtils.damp(g.current.scale.x, scale, 6, dt));
    g.current.position.x = THREE.MathUtils.damp(g.current.position.x, shift, 6, dt);
    const auto = reduced ? 0 : Math.sin(clock.elapsedTime * 0.25) * 0.12;
    g.current.rotation.y = THREE.MathUtils.damp(
      g.current.rotation.y,
      -0.35 + i.x * 0.3 + auto + i.scroll * 0.6,
      3,
      dt,
    );
    g.current.rotation.x = THREE.MathUtils.damp(g.current.rotation.x, 0.12 - i.y * 0.12, 3, dt);
    g.current.position.y = THREE.MathUtils.damp(g.current.position.y, i.scroll * 1.2, 3, dt);
  });
  return <group ref={g}>{children}</group>;
}

function Scene({
  input,
  reduced,
  small,
}: {
  input: React.RefObject<Input>;
  reduced: boolean;
  small: boolean;
}) {
  return (
    <>
      <hemisphereLight args={["#8aa0ff", "#2a1d3a", 0.55]} />
      <directionalLight position={[-4, 8, 5]} intensity={0.9} color="#a5b8ff" />
      <Rig input={input} reduced={reduced}>
        <Core />
        <Links />
        <LampIsland reduced={reduced} />
        <ComputerIsland reduced={reduced} />
        <AcIsland reduced={reduced} />
        <PlugIsland reduced={reduced} />
        <Dust count={small ? 60 : 140} reduced={reduced} />
      </Rig>
    </>
  );
}

/** Cena 3D do hero: ilhas flutuantes (luz, PC, AC, tomada) ligadas a um núcleo. */
export default function HeroScene({ active, reducedMotion }: HeroSceneProps) {
  const input = useRef<Input>({ x: 0, y: 0, scroll: 0 });
  const small = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      input.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      input.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const scroll = () => {
      input.current.scroll = Math.min(1, window.scrollY / Math.max(window.innerHeight, 1));
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", scroll);
    };
  }, []);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      camera={{ position: [0, 1.2, 13], fov: 38, near: 0.1, far: 60 }}
      gl={{ antialias: !small, alpha: true, powerPreference: "default" }}
      style={{ background: "transparent" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
      }}
      aria-hidden="true"
    >
      <FrameDriver active={active} fps={30} />
      <Scene input={input} reduced={reducedMotion} small={small} />
    </Canvas>
  );
}
