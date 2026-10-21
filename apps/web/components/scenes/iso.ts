/**
 * Projeção isométrica. Mundo: x cresce para a direita-baixo, y para a
 * esquerda-baixo, z para cima. Unidade = 1 "tile".
 */
export const TILE = 34;
export const LIFT = 38;
export const OX = 276;
export const OY = 128;

export type Pt = readonly [number, number];

export function project(x: number, y: number, z: number): Pt {
  return [(x - y) * TILE + OX, (x + y) * (TILE / 2) - z * LIFT + OY];
}

export function poly(points: readonly Pt[]): string {
  return points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
}

export interface BoxGeometry {
  readonly top: string;
  readonly left: string;
  readonly right: string;
}

/** As três faces visíveis de uma caixa alinhada aos eixos. */
export function boxFaces(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
): BoxGeometry {
  const p = project;
  return {
    top: poly([p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)]),
    left: poly([p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)]),
    right: poly([p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)]),
  };
}

/** Cor oklch com variação de luminosidade para as faces. */
export function tone(
  hue: number,
  chroma: number,
  lightness: number,
): { top: string; left: string; right: string } {
  const c = (l: number) => `oklch(${l.toFixed(3)} ${chroma} ${hue})`;
  return { top: c(lightness + 0.07), left: c(lightness), right: c(lightness - 0.07) };
}
