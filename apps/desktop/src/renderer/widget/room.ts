/**
 * Cena isométrica do ambiente (SVG gerado em código). Cada cômodo tem um
 * glow de piso cuja intensidade (--lit) acompanha a fração de luzes
 * acesas; o ar-condicionado ligado solta "névoa" azul. Tudo animado em CSS.
 */
export type RoomId = "living" | "kitchen" | "bedroom" | "dining";

const S = 24;
const COS = 0.866;
const SIN = 0.5;

type P3 = readonly [number, number, number];

function proj([x, y, z]: P3): string {
  return `${((x - y) * COS * S).toFixed(1)},${((x + y) * SIN * S - z * S).toFixed(1)}`;
}

function poly(points: P3[], fill: string, extra = ""): string {
  return `<polygon points="${points.map(proj).join(" ")}" fill="${fill}" ${extra}/>`;
}

interface Tone {
  top: string;
  left: string;
  right: string;
}

let order = 0;

function box(x: number, y: number, z: number, w: number, d: number, h: number, tone: Tone): string {
  const i = order++;
  const faces = [
    poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], tone.left),
    poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], tone.right),
    poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], tone.top),
  ];
  return `<g class="blk" style="--i:${i}">${faces.join("")}</g>`;
}

const tone = (top: string, left: string, right: string): Tone => ({ top, left, right });
const SOFA = tone("#3a5fb8", "#2a4590", "#22397a");
const BED = tone("#4a69c4", "#33509f", "#2a437f");
const LINEN = tone("#c9d6ff", "#8fa3dd", "#7a8fcc");
const WOOD = tone("#7a5a3c", "#5a4129", "#48341f");
const DARK = tone("#26304f", "#1b2340", "#151c35");
const STONE = tone("#aab6d8", "#7e8db8", "#6a7aa6");
const GREEN = tone("#2f8a6a", "#216b52", "#1a5642");

interface Glow {
  room: RoomId;
  x: number;
  y: number;
}

const GLOWS: Glow[] = [
  { room: "kitchen", x: 2.5, y: 1.6 },
  { room: "living", x: 2.4, y: 5.4 },
  { room: "bedroom", x: 7.4, y: 1.4 },
  { room: "dining", x: 7.4, y: 5.8 },
];

export function buildRoom(): string {
  order = 0;
  const floor = poly([[0, 0, 0], [10, 0, 0], [10, 8, 0], [0, 8, 0]], "url(#floor)");
  const planks = Array.from({ length: 9 }, (_, i) => {
    const a = proj([i + 1, 0, 0]);
    const b = proj([i + 1, 8, 0]);
    return `<line x1="${a.split(",")[0]}" y1="${a.split(",")[1]}" x2="${b.split(",")[0]}" y2="${b.split(",")[1]}" stroke="rgba(150,180,255,.07)"/>`;
  }).join("");
  const wallBack = poly([[0, 0, 0], [10, 0, 0], [10, 0, 3.2], [0, 0, 3.2]], "url(#wallR)");
  const wallLeft = poly([[0, 0, 0], [0, 8, 0], [0, 8, 3.2], [0, 0, 3.2]], "url(#wallL)");
  const trimPts: P3[] = [[0, 8, 3.2], [0, 0, 3.2], [10, 0, 3.2]];
  const trim = `<polyline points="${trimPts.map((p) => proj(p)).join(" ")}" fill="none" stroke="rgba(160,190,255,.35)" stroke-width="1.4"/>`;
  const windowsGlow = [
    poly([[1.2, 0, 1.2], [3.2, 0, 1.2], [3.2, 0, 2.7], [1.2, 0, 2.7]], "url(#moon)"),
    poly([[6.4, 0, 1.2], [8.6, 0, 1.2], [8.6, 0, 2.7], [6.4, 0, 2.7]], "url(#moon)"),
    poly([[0, 1.6, 1.2], [0, 3.4, 1.2], [0, 3.4, 2.7], [0, 1.6, 2.7]], "url(#moon)"),
  ].join("");

  const glowDefs = GLOWS.map(
    (g) =>
      `<ellipse class="glow" data-room="${g.room}" cx="${proj([g.x, g.y, 0]).split(",")[0]}" cy="${proj([g.x, g.y, 0]).split(",")[1]}" rx="78" ry="40" fill="url(#warm)"/>`,
  ).join("");
  const bulbs = GLOWS.map(
    (g) =>
      `<g class="bulb" data-room="${g.room}"><circle cx="${proj([g.x, g.y, 3.0]).split(",")[0]}" cy="${proj([g.x, g.y, 3.0]).split(",")[1]}" r="3.2"/><circle class="halo" cx="${proj([g.x, g.y, 3.0]).split(",")[0]}" cy="${proj([g.x, g.y, 3.0]).split(",")[1]}" r="11"/></g>`,
  ).join("");

  const furniture = [
    // cozinha (parede do fundo)
    box(0.5, 0.15, 0, 4.2, 1.1, 0.95, STONE),
    box(0.5, 0.15, 0.95, 4.2, 1.1, 0.08, DARK),
    box(1.5, 2.1, 0, 2.2, 0.9, 0.85, DARK),
    // quarto
    box(6.0, 0.4, 0, 2.8, 3.0, 0.55, BED),
    box(6.0, 0.4, 0.55, 2.8, 2.2, 0.18, LINEN),
    box(9.0, 0.6, 0, 0.7, 0.7, 0.6, WOOD),
    // sala
    box(0.15, 3.2, 0, 0.7, 3.2, 0.55, DARK),
    box(0.1, 3.5, 0.55, 0.12, 2.6, 1.3, tone("#0b1226", "#0b1226", "#101a36")),
    box(1.2, 5.6, 0, 3.2, 1.3, 0.62, SOFA),
    box(1.2, 6.6, 0, 3.2, 0.35, 1.1, SOFA),
    box(1.9, 3.7, 0, 1.6, 1.0, 0.3, WOOD),
    box(3.9, 2.6, 0, 0.6, 0.6, 1.5, GREEN),
    // jantar
    box(6.2, 5.3, 0, 3.0, 1.8, 0.85, WOOD),
    box(6.4, 4.5, 0, 0.7, 0.7, 0.5, DARK),
    box(8.3, 4.5, 0, 0.7, 0.7, 0.5, DARK),
    box(6.4, 7.2, 0, 0.7, 0.7, 0.5, DARK),
    box(8.3, 7.2, 0, 0.7, 0.7, 0.5, DARK),
  ].join("");

  const partitions = [
    box(4.9, 0, 0, 0.14, 3.4, 1.7, tone("#33437a", "#25325f", "#1d2850")),
    box(4.9, 3.3, 0, 5.1, 0.14, 1.7, tone("#33437a", "#25325f", "#1d2850")),
  ].join("");

  const ac = `<g class="mist">${[0, 1, 2]
    .map((i) => {
      const [sx, sy] = proj([0.4 + i * 0.5, 7.4 - i * 0.2, 2.4]).split(",");
      return `<path class="wisp" style="--d:${i * 0.7}s" d="M${sx} ${sy} q 10 14 0 28 t 2 28" />`;
    })
    .join("")}</g>`;

  const dust = Array.from({ length: 14 }, (_, i) => {
    const px = ((i * 53) % 340) - 170;
    const py = ((i * 37) % 210) - 40;
    return `<circle class="dust" style="--d:${(i % 7) * 0.6}s" cx="${px}" cy="${py}" r="${1 + (i % 3) * 0.5}"/>`;
  }).join("");

  return `
<svg class="room" viewBox="-182 -92 404 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#232b4f"/><stop offset="1" stop-color="#171d3a"/></linearGradient>
    <linearGradient id="wallR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2c58"/><stop offset="1" stop-color="#141c3c"/></linearGradient>
    <linearGradient id="wallL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18224a"/><stop offset="1" stop-color="#0e1530"/></linearGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa8ff" stop-opacity=".75"/><stop offset="1" stop-color="#3b57b8" stop-opacity=".35"/></linearGradient>
    <radialGradient id="warm"><stop offset="0" stop-color="#ffd58a" stop-opacity=".85"/><stop offset=".5" stop-color="#ffb35c" stop-opacity=".28"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <g class="scene">
    <ellipse cx="20" cy="232" rx="170" ry="26" fill="#000" opacity=".35" filter="url(#soft)"/>
    ${wallLeft}${wallBack}${windowsGlow}${floor}${planks}${trim}
    ${glowDefs}
    ${furniture}
    ${partitions}
    ${bulbs}
    ${ac}
    ${dust}
  </g>
</svg>`;
}

export function updateRoom(root: Element, lit: Record<RoomId, number>, cool: boolean): void {
  for (const el of root.querySelectorAll<SVGElement>("[data-room]")) {
    const room = el.dataset.room as RoomId;
    const value = lit[room] ?? 0;
    el.style.setProperty("--lit", String(value));
    el.toggleAttribute("data-on", value > 0);
  }
  root.classList.toggle("is-cool", cool);
}
