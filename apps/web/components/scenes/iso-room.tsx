"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useId } from "react";

import { boxFaces, poly, project, tone } from "./iso";

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

const W = 9;
const D = 7;
const WALL = 3;

interface Block {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly colors: { top: string; left: string; right: string };
  readonly glow?: boolean;
}

const sofa = tone(255, 0.07, 0.42);
const wood = tone(60, 0.06, 0.38);
const bedC = tone(250, 0.1, 0.5);
const linen = tone(250, 0.02, 0.82);
const rugC = tone(262, 0.09, 0.32);
const plant = tone(150, 0.1, 0.45);
const metal = tone(250, 0.02, 0.7);
const dark = tone(262, 0.03, 0.22);

const FLOOR_GLOWS: readonly { x: number; y: number; r: number }[] = [
  { x: 3, y: 3.2, r: 150 },
  { x: 6.8, y: 1.6, r: 120 },
  { x: 2.6, y: 5.4, r: 110 },
  { x: 6.8, y: 5.2, r: 120 },
  { x: 1.1, y: 5.9, r: 80 },
  { x: 4.8, y: 2.6, r: 90 },
];

function blocks(pcOn: boolean): Block[] {
  const list: Block[] = [
    { key: "rug", x: 2, y: 2.2, z: 0, w: 3.6, d: 2.6, h: 0.03, colors: rugC },
    // sofá (encosto + assento + braços)
    { key: "sofa-back", x: 0.3, y: 2.4, z: 0, w: 0.4, d: 2.8, h: 0.95, colors: sofa },
    {
      key: "sofa-seat",
      x: 0.7,
      y: 2.4,
      z: 0,
      w: 0.9,
      d: 2.8,
      h: 0.45,
      colors: tone(255, 0.07, 0.48),
    },
    { key: "sofa-arm1", x: 0.7, y: 2.4, z: 0, w: 0.9, d: 0.3, h: 0.7, colors: sofa },
    { key: "sofa-arm2", x: 0.7, y: 4.9, z: 0, w: 0.9, d: 0.3, h: 0.7, colors: sofa },
    // mesa de centro
    { key: "coffee", x: 3.2, y: 3.0, z: 0, w: 1.1, d: 1.1, h: 0.35, colors: wood },
    // móvel de TV + TV
    { key: "tv-unit", x: 2.4, y: 0.15, z: 0, w: 2.6, d: 0.6, h: 0.4, colors: wood },
    { key: "tv", x: 2.9, y: 0.3, z: 0.4, w: 1.6, d: 0.1, h: 0.95, colors: dark, glow: true },
    // cama
    { key: "bed", x: 5.6, y: 0.2, z: 0, w: 2.9, d: 2.3, h: 0.4, colors: wood },
    { key: "mattress", x: 5.65, y: 0.45, z: 0.4, w: 2.8, d: 2.0, h: 0.28, colors: bedC },
    {
      key: "blanket",
      x: 5.65,
      y: 1.25,
      z: 0.68,
      w: 2.8,
      d: 1.2,
      h: 0.08,
      colors: tone(255, 0.12, 0.6),
    },
    { key: "pillow1", x: 5.8, y: 0.5, z: 0.68, w: 0.9, d: 0.55, h: 0.12, colors: linen },
    { key: "pillow2", x: 7.2, y: 0.5, z: 0.68, w: 0.9, d: 0.55, h: 0.12, colors: linen },
    { key: "headboard", x: 5.6, y: 0.1, z: 0, w: 2.9, d: 0.15, h: 1.1, colors: wood },
    // mesa de jantar + cadeiras
    { key: "table", x: 2.6, y: 5.0, z: 0.62, w: 2.0, d: 1.3, h: 0.1, colors: wood },
    { key: "table-leg1", x: 2.7, y: 5.1, z: 0, w: 0.12, d: 0.12, h: 0.62, colors: wood },
    { key: "table-leg2", x: 4.4, y: 6.1, z: 0, w: 0.12, d: 0.12, h: 0.62, colors: wood },
    { key: "chair1", x: 3.0, y: 4.45, z: 0, w: 0.45, d: 0.45, h: 0.45, colors: dark },
    { key: "chair2", x: 3.9, y: 4.45, z: 0, w: 0.45, d: 0.45, h: 0.45, colors: dark },
    { key: "chair3", x: 3.0, y: 6.4, z: 0, w: 0.45, d: 0.45, h: 0.45, colors: dark },
    // mesa de trabalho + monitor + cadeira
    { key: "desk", x: 6.2, y: 5.0, z: 0.65, w: 2.3, d: 1.0, h: 0.1, colors: wood },
    { key: "desk-leg1", x: 6.3, y: 5.9, z: 0, w: 0.1, d: 0.1, h: 0.65, colors: metal },
    { key: "desk-leg2", x: 8.3, y: 5.9, z: 0, w: 0.1, d: 0.1, h: 0.65, colors: metal },
    { key: "monitor-stand", x: 7.1, y: 5.35, z: 0.75, w: 0.3, d: 0.2, h: 0.12, colors: metal },
    {
      key: "monitor",
      x: 6.8,
      y: 5.4,
      z: 0.87,
      w: 0.95,
      d: 0.08,
      h: 0.58,
      colors: pcOn ? tone(200, 0.12, 0.74) : dark,
      glow: pcOn,
    },
    { key: "office-chair", x: 7.1, y: 6.2, z: 0, w: 0.6, d: 0.6, h: 0.5, colors: dark },
    { key: "office-chair-back", x: 7.1, y: 6.75, z: 0.5, w: 0.6, d: 0.1, h: 0.6, colors: dark },
    // planta e abajur de piso
    { key: "pot", x: 0.4, y: 0.5, z: 0, w: 0.55, d: 0.55, h: 0.4, colors: tone(40, 0.08, 0.55) },
    { key: "leaves", x: 0.3, y: 0.4, z: 0.4, w: 0.75, d: 0.75, h: 0.85, colors: plant },
    { key: "lamp-pole", x: 1.0, y: 5.7, z: 0, w: 0.1, d: 0.1, h: 1.5, colors: metal },
    {
      key: "lamp-head",
      x: 0.8,
      y: 5.5,
      z: 1.5,
      w: 0.5,
      d: 0.5,
      h: 0.4,
      colors: tone(80, 0.12, 0.85),
    },
    // ar-condicionado na parede
    { key: "ac", x: 4.8, y: 0.05, z: 1.95, w: 1.5, d: 0.28, h: 0.42, colors: tone(250, 0.01, 0.9) },
  ];
  return list.sort((a, b) => a.x + a.y + (a.w + a.d) / 2 - (b.x + b.y + (b.w + b.d) / 2));
}

/** Cena isométrica do ambiente: reage a luzes, PCs e AC; inclina com o mouse. */
export function IsoRoom({
  lightsOn,
  lightsTotal,
  computersOnline,
  acOn,
  tint,
  ambient = 1,
}: IsoRoomProps) {
  const uid = useId().replace(/:/g, "");
  const frac = lightsTotal === 0 ? 0 : lightsOn / lightsTotal;
  const level = 0.5 + 0.5 * Math.min(1, ambient * 0.5 + frac * 0.6);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-9, 9]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-1, 1], [8, -8]), { stiffness: 120, damping: 18 });

  const p = project;
  const floor = poly([p(0, 0, 0), p(W, 0, 0), p(W, D, 0), p(0, D, 0)]);
  const wallRight = poly([p(0, 0, 0), p(W, 0, 0), p(W, 0, WALL), p(0, 0, WALL)]);
  const wallLeft = poly([p(0, 0, 0), p(0, D, 0), p(0, D, WALL), p(0, 0, WALL)]);
  const edgeLeft = poly([p(0, D, 0), p(W, D, 0), p(W, D, -0.35), p(0, D, -0.35)]);
  const edgeRight = poly([p(W, 0, 0), p(W, D, 0), p(W, D, -0.35), p(W, 0, -0.35)]);
  const silhouette = poly([
    p(0, D, WALL),
    p(0, 0, WALL),
    p(W, 0, WALL),
    p(W, 0, 0),
    p(W, D, 0),
    p(0, D, 0),
  ]);
  const windowA = poly([p(1.1, 0, 1.1), p(3.0, 0, 1.1), p(3.0, 0, 2.6), p(1.1, 0, 2.6)]);
  const windowB = poly([p(0, 3.6, 1.1), p(0, 5.4, 1.1), p(0, 5.4, 2.6), p(0, 3.6, 2.6)]);
  const shaft = poly([p(1.1, 0, 0), p(3.0, 0, 0), p(4.6, 2.6, 0), p(2.7, 2.6, 0)]);
  const [acx, acy] = p(5.55, 0.4, 1.9);

  const mood = tint ?? "oklch(0.8 0.1 80)";

  return (
    <div
      className="relative mx-auto aspect-[552/430] w-full max-w-[620px] [perspective:1200px]"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        px.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
        py.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      <motion.div style={{ rotateX, rotateY }} className="size-full [transform-style:preserve-3d]">
        <motion.svg
          viewBox="0 0 552 430"
          className="size-full overflow-visible drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)]"
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          role="img"
          aria-label="Ilustração isométrica do ambiente"
        >
          <defs>
            <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(0.3 0.12 265)" />
              <stop offset="1" stopColor="oklch(0.5 0.14 250)" />
            </linearGradient>
            <radialGradient id={`glow-${uid}`}>
              <stop offset="0" stopColor="oklch(0.92 0.12 85)" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="oklch(0.85 0.13 75)" stopOpacity="0.35" />
              <stop offset="1" stopColor="oklch(0.8 0.12 70)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`floor-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="oklch(0.36 0.04 60)" />
              <stop offset="1" stopColor="oklch(0.28 0.04 55)" />
            </linearGradient>
          </defs>

          {/* sombra projetada no "chão" do vazio */}
          <ellipse
            cx="276"
            cy="410"
            rx="230"
            ry="26"
            fill="black"
            opacity="0.35"
            filter="blur(14px)"
          />

          <motion.g
            animate={{ filter: `brightness(${level.toFixed(2)})` }}
            transition={{ duration: 0.9 }}
          >
            <polygon points={edgeLeft} fill="oklch(0.2 0.03 262)" />
            <polygon points={edgeRight} fill="oklch(0.16 0.03 262)" />
            <polygon points={wallLeft} fill="oklch(0.34 0.06 262)" />
            <polygon points={wallRight} fill="oklch(0.4 0.06 262)" />
            <polygon points={floor} fill={`url(#floor-${uid})`} />

            {/* tábuas do piso */}
            {Array.from({ length: 8 }, (_, i) => (
              <polyline
                // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, nunca reordena
                key={`plank-${i}`}
                points={poly([p(i + 1, 0, 0), p(i + 1, D, 0)])}
                stroke="oklch(0.2 0.03 60)"
                strokeOpacity="0.35"
                fill="none"
              />
            ))}

            {/* janelas */}
            <polygon
              points={windowA}
              fill={`url(#sky-${uid})`}
              stroke="oklch(0.85 0.02 250)"
              strokeWidth="2.5"
            />
            <polygon
              points={windowB}
              fill={`url(#sky-${uid})`}
              stroke="oklch(0.85 0.02 250)"
              strokeWidth="2.5"
            />
            {[
              [90, 52],
              [118, 40],
              [74, 76],
            ].map(([sx, sy], i) => (
              <motion.circle
                // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, nunca reordena
                key={`star-${i}`}
                cx={sx}
                cy={sy}
                r="1.3"
                fill="white"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 2.4 + i, repeat: Number.POSITIVE_INFINITY, delay: i * 0.6 }}
              />
            ))}
            <motion.polygon
              points={shaft}
              fill="oklch(0.85 0.1 250)"
              animate={{ opacity: [0.06, 0.13, 0.06] }}
              transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY }}
            />

            {blocks(computersOnline > 0).map((block) => {
              const faces = boxFaces(block.x, block.y, block.z, block.w, block.d, block.h);
              return (
                <g
                  key={block.key}
                  className={block.glow ? "[animation:flicker_3s_ease-in-out_infinite]" : undefined}
                >
                  <polygon points={faces.left} fill={block.colors.left} />
                  <polygon points={faces.right} fill={block.colors.right} />
                  <polygon points={faces.top} fill={block.colors.top} />
                </g>
              );
            })}

            {/* luzes no chão */}
            {FLOOR_GLOWS.map((glow, index) => {
              const [cx, cy] = p(glow.x, glow.y, 0);
              const active = lightsOn > 0 && index / FLOOR_GLOWS.length < Math.max(frac, 0.01);
              return (
                <motion.ellipse
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, nunca reordena
                  key={`glow-${index}`}
                  cx={cx}
                  cy={cy}
                  rx={glow.r}
                  ry={glow.r / 2}
                  fill={`url(#glow-${uid})`}
                  initial={false}
                  animate={{ opacity: active ? [0.7, 1, 0.7] : 0 }}
                  transition={{
                    duration: active ? 4 + index : 0.6,
                    repeat: active ? Number.POSITIVE_INFINITY : 0,
                  }}
                />
              );
            })}

            {/* lâmpadas pendentes */}
            {[
              [3.4, 3.4],
              [6.9, 1.7],
              [6.9, 5.4],
            ].map(([lx, ly], i) => {
              const [bx, by] = p(lx as number, ly as number, WALL - 0.55);
              const [tx, ty] = p(lx as number, ly as number, WALL);
              const active = lightsOn > 0 && i / 3 < Math.max(frac, 0.01);
              return (
                <g
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, nunca reordena
                  key={`pendant-${i}`}
                >
                  <line
                    x1={tx}
                    y1={ty}
                    x2={bx}
                    y2={by}
                    stroke="oklch(0.7 0.02 250)"
                    strokeOpacity="0.6"
                  />
                  <motion.circle
                    cx={bx}
                    cy={by + 4}
                    r="7"
                    initial={false}
                    animate={{
                      fill: active ? "oklch(0.95 0.1 90)" : "oklch(0.4 0.02 250)",
                      scale: active ? [1, 1.12, 1] : 1,
                    }}
                    transition={{ duration: 2.4, repeat: active ? Number.POSITIVE_INFINITY : 0 }}
                  />
                  {active && (
                    <circle cx={bx} cy={by + 4} r="22" fill={`url(#glow-${uid})`} opacity="0.8" />
                  )}
                </g>
              );
            })}

            {/* vento do ar-condicionado */}
            {acOn &&
              [0, 1, 2, 3, 4].map((i) => (
                <motion.circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, nunca reordena
                  key={`snow-${i}`}
                  cx={acx - 38 + i * 19}
                  r="2.2"
                  fill="oklch(0.9 0.08 220)"
                  initial={{ cy: acy + 10, opacity: 0 }}
                  animate={{ cy: acy + 78, opacity: [0, 0.9, 0], x: [0, i % 2 ? 8 : -8, 0] }}
                  transition={{
                    duration: 2.6,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 0.45,
                    ease: "easeIn",
                  }}
                />
              ))}

            {/* atmosfera da cena */}
            <motion.polygon
              points={silhouette}
              initial={false}
              animate={{ fill: mood, opacity: tint ? 0.22 : 0 }}
              transition={{ duration: 0.8 }}
              style={{ mixBlendMode: "soft-light" }}
            />
          </motion.g>
        </motion.svg>
      </motion.div>
    </div>
  );
}
