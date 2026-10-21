"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

interface IsoRoomProps {
  /** Luzes ligadas / total de luzes. */
  readonly lightsOn: number;
  readonly lightsTotal: number;
  readonly computersOnline: number;
  readonly acOn: boolean;
  /** Atmosfera da cena ativa (cor CSS + 0–1 de claridade). */
  readonly tint?: string;
  readonly ambient?: number;
}

/** Metros. x = direita, y = cima, z = em direção à câmera. Paredes em x=0 e z=0. */
const W = 9;
const D = 7;
const WALL = 2.6;
const T = 0.28;
const WARM = "#ffbf73";

type V3 = readonly [number, number, number];

/* ------------------------------------------------------------------ helpers */

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

function cssToColor(css?: string): THREE.Color | null {
  if (!css) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return new THREE.Color().setRGB(
      (r ?? 0) / 255,
      (g ?? 0) / 255,
      (b ?? 0) / 255,
      THREE.SRGBColorSpace,
    );
  } catch {
    return null;
  }
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

interface BoxProps {
  /** Canto mínimo (x, y, z). */
  readonly at: V3;
  readonly size: V3;
  readonly color: string;
  readonly radius?: number;
  readonly roughness?: number;
  readonly cast?: boolean;
}

/** Caixa com cantos arredondados posicionada pelo canto mínimo. */
function Box({ at, size, color, radius = 0.05, roughness = 0.7, cast = true }: BoxProps) {
  const [w, h, d] = size;
  const r = Math.max(0.004, Math.min(radius, Math.min(w, h, d) / 2 - 0.002));
  const geometry = useMemo(() => new RoundedBoxGeometry(w, h, d, 4, r), [w, h, d, r]);
  return (
    <mesh
      geometry={geometry}
      position={[at[0] + w / 2, at[1] + h / 2, at[2] + d / 2]}
      castShadow={cast}
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

interface CylProps {
  readonly at: V3;
  readonly r: number;
  readonly h: number;
  readonly color: string;
  readonly rTop?: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  readonly roughness?: number;
}

function Cyl({
  at,
  r,
  h,
  color,
  rTop,
  emissive,
  emissiveIntensity = 0,
  roughness = 0.6,
}: CylProps) {
  return (
    <mesh position={[at[0], at[1] + h / 2, at[2]]} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------- luzes */

interface BulbProps {
  readonly position: V3;
  readonly on: boolean;
  readonly gain: number;
  readonly power?: number;
  readonly glow?: number;
  readonly shadow?: boolean;
  readonly visible?: boolean;
}

/** Ponto de luz quente com halo; liga/desliga suavemente. */
function Bulb({
  position,
  on,
  gain,
  power = 22,
  glow = 2.6,
  shadow = false,
  visible = true,
}: BulbProps) {
  const light = useRef<THREE.PointLight>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const level = useRef(0);
  const map = useMemo(() => getGlowTexture(), []);

  useFrame((_, dt) => {
    level.current = THREE.MathUtils.damp(level.current, on ? 1 : 0, 4, dt);
    const l = level.current;
    if (light.current) light.current.intensity = power * gain * l;
    if (halo.current) halo.current.opacity = 0.85 * l;
    if (core.current) core.current.emissiveIntensity = 0.15 + 3 * l;
  });

  return (
    <group position={position}>
      <pointLight
        ref={light}
        color={WARM}
        intensity={0}
        distance={13}
        decay={1.6}
        castShadow={shadow}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
      />
      {visible && (
        <mesh>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshStandardMaterial
            ref={core}
            color="#fff3d8"
            emissive={WARM}
            emissiveIntensity={0.15}
          />
        </mesh>
      )}
      <sprite scale={[glow, glow, 1]}>
        <spriteMaterial
          ref={halo}
          map={map}
          color={WARM}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

interface PendantProps {
  readonly x: number;
  readonly z: number;
  readonly on: boolean;
  readonly gain: number;
  readonly shadow?: boolean;
}

function Pendant({ x, z, on, gain, shadow }: PendantProps) {
  return (
    <group>
      <mesh position={[x, WALL + 0.35, z]}>
        <cylinderGeometry args={[0.008, 0.008, 1.5, 6]} />
        <meshStandardMaterial color="#d6d9ee" />
      </mesh>
      <Bulb
        position={[x, WALL - 0.45, z]}
        on={on}
        gain={gain}
        power={18}
        glow={3.2}
        shadow={shadow}
      />
    </group>
  );
}

/* ------------------------------------------------------------- estrutura */

type Hole = readonly [number, number, number, number];

/** Parede ao longo de um eixo com aberturas (janelas): [início, fim, base, topo]. */
function WallRun({ axis, holes }: { axis: "x" | "z"; holes: readonly Hole[] }) {
  const length = axis === "x" ? W : D;
  const sorted = [...holes].sort((a, b) => a[0] - b[0]);
  const color = axis === "x" ? "#9fa3cc" : "#8a8ec0";
  const frame = "#f1f2fb";
  const pieces: { a: number; b: number; y0: number; y1: number }[] = [];
  let cursor = -T;
  for (const [a, b, y0, y1] of sorted) {
    pieces.push({ a: cursor, b: a, y0: 0, y1: WALL });
    pieces.push({ a, b, y0: 0, y1: y0 });
    pieces.push({ a, b, y0: y1, y1: WALL });
    cursor = b;
  }
  pieces.push({ a: cursor, b: length, y0: 0, y1: WALL });

  // helpers que escrevem na orientação certa (x: parede em z=0; z: parede em x=0)
  const at = (along: number, y: number): V3 => (axis === "x" ? [along, y, -T] : [-T, y, along]);
  const dims = (along: number, y: number, thick: number): V3 =>
    axis === "x" ? [along, y, thick] : [thick, y, along];

  return (
    <group>
      {pieces.map((s) => {
        const len = s.b - s.a;
        if (len <= 0.001 || s.y1 - s.y0 <= 0.001) return null;
        return (
          <Box
            key={`${axis}-${s.a}-${s.b}-${s.y0}`}
            at={at(s.a, s.y0)}
            size={dims(len, s.y1 - s.y0, T)}
            color={color}
            radius={0.02}
            roughness={0.95}
          />
        );
      })}
      {sorted.map(([a, b, y0, y1]) => {
        const mid = (a + b) / 2;
        const glassPos: V3 =
          axis === "x" ? [mid, (y0 + y1) / 2, -T / 2] : [-T / 2, (y0 + y1) / 2, mid];
        return (
          <group key={`win-${a}`}>
            <mesh position={glassPos} rotation={[0, axis === "x" ? 0 : Math.PI / 2, 0]}>
              <planeGeometry args={[b - a, y1 - y0]} />
              <meshBasicMaterial color="#27408f" />
            </mesh>
            <Box
              at={at(a - 0.05, y0 - 0.05)}
              size={dims(b - a + 0.1, 0.1, T + 0.04)}
              color={frame}
              radius={0.02}
            />
            <Box
              at={at(a - 0.05, y1 - 0.05)}
              size={dims(b - a + 0.1, 0.1, T + 0.04)}
              color={frame}
              radius={0.02}
            />
            <Box
              at={at(a - 0.05, y0)}
              size={dims(0.1, y1 - y0, T + 0.04)}
              color={frame}
              radius={0.02}
            />
            <Box
              at={at(b - 0.05, y0)}
              size={dims(0.1, y1 - y0, T + 0.04)}
              color={frame}
              radius={0.02}
            />
            <Box
              at={at(mid - 0.03, y0)}
              size={dims(0.06, y1 - y0, T + 0.04)}
              color={frame}
              radius={0.02}
            />
            <Box
              at={at(a, (y0 + y1) / 2 - 0.03)}
              size={dims(b - a, 0.06, T + 0.04)}
              color={frame}
              radius={0.02}
            />
          </group>
        );
      })}
    </group>
  );
}

function Shell() {
  const floorMap = useMemo(() => makeFloorTexture(), []);
  return (
    <group>
      {/* laje */}
      <Box
        at={[-T, -0.45, -T]}
        size={[W + T, 0.45, D + T]}
        color="#241f33"
        radius={0.06}
        roughness={0.9}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0.002, D / 2]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorMap} roughness={0.55} />
      </mesh>
      <WallRun axis="x" holes={[[6.5, 7.9, 1.0, 2.1]]} />
      <WallRun
        axis="z"
        holes={[
          [1.0, 2.7, 1.0, 2.1],
          [4.3, 6.0, 1.0, 2.1],
        ]}
      />
      {/* rodapés */}
      <Box at={[0, 0, 0]} size={[W, 0.12, 0.04]} color="#eceefb" radius={0.015} cast={false} />
      <Box at={[0, 0, 0]} size={[0.04, 0.12, D]} color="#eceefb" radius={0.015} cast={false} />
      {/* divisórias baixas */}
      <Box at={[4.9, 0, 0]} size={[0.16, 1.2, 2.9]} color="#d7d9f0" radius={0.04} roughness={0.9} />
      <Box
        at={[4.9, 0, 3.4]}
        size={[W - 4.9, 1.2, 0.16]}
        color="#d7d9f0"
        radius={0.04}
        roughness={0.9}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ móveis */

const WOOD = "#6b4430";

function DiningChair({ x, z, facing }: { x: number; z: number; facing: 1 | -1 }) {
  // facing 1: encosto em z-; -1: encosto em z+
  const backZ = facing === 1 ? z - 0.03 : z + 0.47;
  return (
    <group>
      <Box at={[x, 0.42, z]} size={[0.5, 0.07, 0.5]} color="#2b2f48" radius={0.03} />
      <Box at={[x, 0.42, backZ]} size={[0.5, 0.55, 0.06]} color="#2b2f48" radius={0.03} />
      <Box at={[x + 0.04, 0, z + 0.04]} size={[0.05, 0.42, 0.05]} color="#1c1f33" radius={0.015} />
      <Box at={[x + 0.41, 0, z + 0.04]} size={[0.05, 0.42, 0.05]} color="#1c1f33" radius={0.015} />
      <Box at={[x + 0.04, 0, z + 0.41]} size={[0.05, 0.42, 0.05]} color="#1c1f33" radius={0.015} />
      <Box at={[x + 0.41, 0, z + 0.41]} size={[0.05, 0.42, 0.05]} color="#1c1f33" radius={0.015} />
    </group>
  );
}

function Living() {
  const sofa = "#7b8fcf";
  const cushion = "#92a4de";
  const tableLegs: V3[] = [
    [2.2, 0, 2.3],
    [3.1, 0, 2.3],
    [2.2, 0, 2.85],
    [3.1, 0, 2.85],
  ];
  const diningLegs: V3[] = [
    [1.75, 0, 5.62],
    [3.4, 0, 5.62],
    [1.75, 0, 6.35],
    [3.4, 0, 6.35],
  ];
  return (
    <group>
      {/* tapete */}
      <Box
        at={[1.0, 0, 1.5]}
        size={[3.4, 0.03, 2.9]}
        color="#3f4d8c"
        radius={0.015}
        roughness={1}
      />
      {/* rack + TV */}
      <Box at={[1.2, 0, 0.1]} size={[2.7, 0.5, 0.55]} color={WOOD} radius={0.05} />
      <Box
        at={[1.55, 1.0, 0.06]}
        size={[1.9, 1.05, 0.07]}
        color="#0d1120"
        radius={0.03}
        roughness={0.3}
      />
      <mesh position={[2.5, 1.525, 0.105]}>
        <planeGeometry args={[1.8, 0.95]} />
        <meshStandardMaterial color="#0e1a3c" emissive="#27428f" emissiveIntensity={0.7} />
      </mesh>
      {/* sofá voltado para a TV */}
      <Box at={[1.4, 0, 3.75]} size={[2.6, 0.42, 1.0]} color={sofa} radius={0.14} roughness={0.9} />
      <Box
        at={[1.4, 0.2, 4.45]}
        size={[2.6, 0.85, 0.3]}
        color={sofa}
        radius={0.14}
        roughness={0.9}
      />
      <Box at={[1.3, 0, 3.75]} size={[0.3, 0.62, 1.0]} color={sofa} radius={0.12} roughness={0.9} />
      <Box at={[3.7, 0, 3.75]} size={[0.3, 0.62, 1.0]} color={sofa} radius={0.12} roughness={0.9} />
      <Box
        at={[1.62, 0.42, 3.8]}
        size={[1.0, 0.16, 0.7]}
        color={cushion}
        radius={0.07}
        roughness={0.9}
      />
      <Box
        at={[2.72, 0.42, 3.8]}
        size={[1.0, 0.16, 0.7]}
        color={cushion}
        radius={0.07}
        roughness={0.9}
      />
      {/* mesa de centro */}
      <Box at={[2.1, 0.32, 2.2]} size={[1.3, 0.07, 0.75]} color="#c79764" radius={0.03} />
      {tableLegs.map((at) => (
        <Box
          key={`leg-${at[0]}-${at[2]}`}
          at={at}
          size={[0.07, 0.32, 0.07]}
          color={WOOD}
          radius={0.02}
        />
      ))}
      <Box at={[2.9, 0.39, 2.4]} size={[0.28, 0.04, 0.2]} color="#b94a4a" radius={0.015} />
      {/* poltrona */}
      <Box
        at={[0.45, 0, 1.55]}
        size={[1.0, 0.4, 1.0]}
        color="#cf9d62"
        radius={0.14}
        roughness={0.85}
      />
      <Box
        at={[0.4, 0.15, 1.55]}
        size={[0.3, 0.85, 1.0]}
        color="#cf9d62"
        radius={0.14}
        roughness={0.85}
      />
      <Box
        at={[0.45, 0, 1.45]}
        size={[1.0, 0.62, 0.22]}
        color="#c18f56"
        radius={0.1}
        roughness={0.85}
      />
      <Box
        at={[0.45, 0, 2.43]}
        size={[1.0, 0.62, 0.22]}
        color="#c18f56"
        radius={0.1}
        roughness={0.85}
      />
      <Box
        at={[0.78, 0.4, 1.7]}
        size={[0.62, 0.14, 0.7]}
        color="#e0b27a"
        radius={0.06}
        roughness={0.85}
      />
      {/* planta topiaria */}
      <Cyl at={[0.5, 0, 0.55]} r={0.22} h={0.38} color="#32364e" />
      <Cyl at={[0.5, 0.38, 0.55]} r={0.03} h={0.5} color="#5a3d2a" />
      <mesh position={[0.5, 1.05, 0.55]} castShadow>
        <sphereGeometry args={[0.36, 24, 24]} />
        <meshStandardMaterial color="#2f7a4a" roughness={0.9} />
      </mesh>
      <mesh position={[0.5, 1.5, 0.55]} castShadow>
        <sphereGeometry args={[0.27, 24, 24]} />
        <meshStandardMaterial color="#368a55" roughness={0.9} />
      </mesh>
      {/* jantar */}
      <Box at={[1.6, 0.74, 5.5]} size={[2.1, 0.08, 1.0]} color="#8b5a3b" radius={0.03} />
      {diningLegs.map((at) => (
        <Box
          key={`dl-${at[0]}-${at[2]}`}
          at={at}
          size={[0.09, 0.74, 0.09]}
          color="#3a2a22"
          radius={0.02}
        />
      ))}
      <DiningChair x={1.95} z={4.85} facing={1} />
      <DiningChair x={2.85} z={4.85} facing={1} />
      <DiningChair x={1.95} z={6.55} facing={-1} />
      <DiningChair x={2.85} z={6.55} facing={-1} />
      <Cyl at={[2.65, 0.82, 6.0]} r={0.12} h={0.2} rTop={0.16} color="#e8e1d6" />
    </group>
  );
}

function Bedroom() {
  return (
    <group>
      <Box at={[5.8, 0, 0.18]} size={[2.4, 0.4, 2.5]} color="#4b3326" radius={0.06} />
      <Box
        at={[5.85, 0.4, 0.24]}
        size={[2.3, 0.28, 2.38]}
        color="#e3e5f4"
        radius={0.1}
        roughness={0.95}
      />
      <Box
        at={[5.85, 0.62, 1.15]}
        size={[2.32, 0.14, 1.5]}
        color="#a9acd9"
        radius={0.07}
        roughness={0.95}
      />
      <Box
        at={[6.05, 0.66, 0.34]}
        size={[0.9, 0.2, 0.5]}
        color="#f4f5fc"
        radius={0.09}
        roughness={0.95}
      />
      <Box
        at={[7.05, 0.66, 0.34]}
        size={[0.9, 0.2, 0.5]}
        color="#f4f5fc"
        radius={0.09}
        roughness={0.95}
      />
      <Box at={[5.7, 0, 0.06]} size={[2.6, 1.15, 0.12]} color="#5d4231" radius={0.05} />
      {[5.2, 8.25].map((nx) => (
        <Box key={`ns-${nx}`} at={[nx, 0, 0.2]} size={[0.5, 0.5, 0.5]} color={WOOD} radius={0.05} />
      ))}
      {/* ar-condicionado */}
      <Box
        at={[5.15, 2.0, 0.04]}
        size={[1.25, 0.4, 0.28]}
        color="#f4f5fb"
        radius={0.1}
        roughness={0.4}
        cast={false}
      />
      <Box
        at={[5.25, 2.04, 0.3]}
        size={[1.05, 0.04, 0.03]}
        color="#c3c7de"
        radius={0.01}
        cast={false}
      />
    </group>
  );
}

function Office({ pcOn }: { pcOn: boolean }) {
  const legs: V3[] = [
    [5.8, 0, 4.4],
    [7.8, 0, 4.4],
    [5.8, 0, 5.1],
    [7.8, 0, 5.1],
  ];
  return (
    <group>
      <Box at={[5.7, 0.72, 4.3]} size={[2.3, 0.08, 0.95]} color="#8b5a3b" radius={0.03} />
      {legs.map((at) => (
        <Box
          key={`desk-${at[0]}-${at[2]}`}
          at={at}
          size={[0.07, 0.72, 0.07]}
          color="#c9cce0"
          radius={0.02}
        />
      ))}
      <Box at={[6.7, 0.8, 4.5]} size={[0.3, 0.2, 0.2]} color="#aeb3cf" radius={0.04} />
      <Box
        at={[6.1, 0.95, 4.55]}
        size={[1.2, 0.72, 0.06]}
        color="#10141f"
        radius={0.025}
        roughness={0.3}
      />
      <mesh position={[6.7, 1.31, 4.59]}>
        <planeGeometry args={[1.1, 0.62]} />
        <meshStandardMaterial
          color={pcOn ? "#a7c1ff" : "#0c1020"}
          emissive={pcOn ? "#7fa2ff" : "#000000"}
          emissiveIntensity={pcOn ? 1.2 : 0}
        />
      </mesh>
      {/* cadeira de escritório */}
      <Cyl at={[6.86, 0.08, 5.5]} r={0.04} h={0.34} color="#1d2135" />
      <Box at={[6.55, 0.42, 5.2]} size={[0.62, 0.12, 0.62]} color="#232842" radius={0.06} />
      <Box at={[6.55, 0.5, 5.75]} size={[0.62, 0.7, 0.1]} color="#232842" radius={0.06} />
      <Cyl at={[6.86, 0, 5.5]} r={0.3} h={0.08} color="#14172a" />
    </group>
  );
}

/* --------------------------------------------------------------------- cena */

function AcWind({ on }: { on: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const t = (clock.elapsedTime * 0.45 + i * 0.2) % 1;
      mesh.visible = on;
      mesh.position.set(
        5.35 + i * 0.22 + Math.sin(t * 6 + i) * 0.05,
        1.95 - t * 1.4,
        0.45 + t * 0.7,
      );
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * 0.8;
    });
  });
  return (
    <group>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={`wind-${i}`}
          ref={(m) => {
            refs.current[i] = m;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#bfe6ff" transparent />
        </mesh>
      ))}
    </group>
  );
}

/** Centraliza a câmera, inclina com o mouse e faz a cena flutuar. */
function Rig({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(W / 2 - 0.1, 0.9, D / 2 - 0.1), []);
  useFrame(({ pointer, clock }, dt) => {
    // enquadra a sala inteira mesmo em canvas mais largos/baixos que 552:430
    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const half = Math.tan(THREE.MathUtils.degToRad(FIT_FOV / 2)) * 1.05;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(half * Math.max(1, FIT_ASPECT / aspect)));
    if (Math.abs(perspective.fov - fov) > 0.01) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
    camera.lookAt(target);
    const g = group.current;
    if (!g) return;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, pointer.x * 0.18, 3, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -pointer.y * 0.05, 3, dt);
    g.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.08;
  });
  return (
    <group ref={group} position={[target.x, 0, target.z]}>
      <group position={[-target.x, 0, -target.z]}>{children}</group>
    </group>
  );
}

/** Enquadramento base: fov vertical e proporção em que a sala cabe inteira. */
const FIT_FOV = 24;
const FIT_ASPECT = 552 / 430;

const PENDANTS = [
  { key: "living", x: 2.8, z: 2.9, shadow: true },
  { key: "bed", x: 7.0, z: 1.7, shadow: false },
  { key: "dining", x: 2.65, z: 6.0, shadow: false },
  { key: "office", x: 6.9, z: 5.0, shadow: false },
] as const;

const LAMPS = [
  { key: "floor-lamp", pos: [4.3, 1.5, 4.3] as V3, power: 11, glow: 2.4 },
  { key: "ns-a", pos: [5.45, 0.88, 0.45] as V3, power: 5, glow: 1.3 },
  { key: "ns-b", pos: [8.5, 0.88, 0.45] as V3, power: 5, glow: 1.3 },
] as const;

const TOTAL_LIGHTS = PENDANTS.length + LAMPS.length;

function Scene({ lightsOn, lightsTotal, computersOnline, acOn, tint, ambient = 1 }: IsoRoomProps) {
  const frac = lightsTotal === 0 ? 0 : lightsOn / lightsTotal;
  const tintColor = useMemo(() => cssToColor(tint), [tint]);
  const gain = 0.75 + 0.25 * ambient;
  const isOn = (index: number) => lightsOn > 0 && index / TOTAL_LIGHTS < Math.max(frac, 0.01);
  const lampGlow = (index: number) => (isOn(index) ? 1.4 : 0.05);

  return (
    <>
      <hemisphereLight args={[tintColor ?? "#8aa0ff", "#2a1d3a", 0.26 + 0.14 * ambient]} />
      <directionalLight
        position={[-5, 11, -6]}
        intensity={1.1}
        color="#8fb0ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      {tintColor && (
        <pointLight position={[4.5, 3, 3.5]} color={tintColor} intensity={14} distance={14} />
      )}

      <Rig>
        <Shell />
        <Living />
        <Bedroom />
        <Office pcOn={computersOnline > 0} />
        <AcWind on={acOn} />

        {PENDANTS.map((b, i) => (
          <Pendant key={b.key} x={b.x} z={b.z} on={isOn(i)} gain={gain} shadow={b.shadow} />
        ))}

        {/* abajur de piso */}
        <Cyl at={[4.3, 0, 4.3]} r={0.2} h={0.05} color="#1d2135" />
        <Cyl at={[4.3, 0.05, 4.3]} r={0.018} h={1.35} color="#d6d9ee" />
        <Cyl
          at={[4.3, 1.3, 4.3]}
          r={0.3}
          rTop={0.2}
          h={0.38}
          color="#fff0d2"
          emissive={WARM}
          emissiveIntensity={lampGlow(4)}
          roughness={0.9}
        />
        {/* abajures dos criados-mudos */}
        {[5.45, 8.5].map((nx, i) => (
          <group key={`ns-lamp-${nx}`}>
            <Cyl at={[nx, 0.5, 0.45]} r={0.07} h={0.18} color="#d6d9ee" />
            <Cyl
              at={[nx, 0.66, 0.45]}
              r={0.17}
              rTop={0.11}
              h={0.24}
              color="#fff0d2"
              emissive={WARM}
              emissiveIntensity={lampGlow(5 + i)}
              roughness={0.9}
            />
          </group>
        ))}
        {LAMPS.map((l, i) => (
          <Bulb
            key={l.key}
            position={l.pos}
            on={isOn(PENDANTS.length + i)}
            gain={gain}
            power={l.power}
            glow={l.glow}
            visible={false}
          />
        ))}

        {/* sombra no vazio */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, -0.6, D / 2]}>
          <planeGeometry args={[W * 1.35, D * 1.35]} />
          <meshBasicMaterial
            map={getGlowTexture()}
            color="#000000"
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      </Rig>
    </>
  );
}

/** Cena 3D do ambiente (three.js): reage a luzes, PCs e AC; inclina com o mouse. */
export function IsoRoom(props: IsoRoomProps) {
  return (
    <div className="relative mx-auto aspect-[552/430] w-full max-w-[620px]">
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        camera={{ position: [17, 13.5, 17.5], fov: 22, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.85;
        }}
        aria-label="Ilustração 3D do ambiente"
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
