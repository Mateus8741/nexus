// Planta (port de house-control/web/src/config.js): tudo o que a cena 3D sabe da casa vem deste documento.

export const LIGHT_TYPES = ["ceiling", "pendant", "spots", "floor", "table", "strip"] as const;
export type LightType = (typeof LIGHT_TYPES)[number];
export type Wall = "north" | "south" | "east" | "west";
export type FloorKind = "oak" | "walnut" | "tile" | "stone";
export type LightCap = "brightness" | "temp" | "color";

export interface RawPlan {
  version?: number;
  name?: string;
  wallHeight?: number;
  interiorWallHeight?: number;
  camera?: { azimuth?: number; elevation?: number };
  outdoorTemp?: number;
  rooms: { id: string; name?: string; rect: [number, number, number, number]; floor?: string }[];
  openings?: { type?: string; from: [number, number]; to: [number, number]; sill?: number; head?: number }[];
  furniture?: FurnitureItem[];
  lights?: {
    id: string;
    name?: string;
    room: string;
    type: string;
    pos: [number, number];
    rot?: number;
    y?: number;
    length?: number;
    intensity?: number;
    color?: string;
    capabilities?: string[];
  }[];
  acs?: { id: string; name?: string; room: string; wall: string; pos: [number, number]; y?: number; min?: number; max?: number }[];
  scenes?: { id: string; name?: string; icon?: string; lights?: Record<string, ScenePatch>; acs?: Record<string, ScenePatch> }[];
}

export interface ScenePatch {
  on?: boolean;
  brightness?: number;
  temp?: number;
  color?: string | null;
  sleep?: boolean;
  target?: number;
}

export interface FurnitureItem {
  type: string;
  pos: [number, number];
  rot?: number;
  y?: number;
  width?: number;
  height?: number;
  size?: [number, number];
  color?: string;
  chairs?: number;
  stools?: number;
  upper?: boolean;
}

export interface Room {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  floor: string;
}

export interface Opening {
  type: string;
  from: [number, number];
  to: [number, number];
  sill: number;
  head: number;
}

export interface PlanLight {
  id: string;
  name: string;
  room: string;
  type: LightType;
  pos: [number, number];
  rot: number;
  y?: number;
  length?: number;
  intensity?: number;
  color?: string;
  capabilities: LightCap[];
}

export interface PlanAC {
  id: string;
  name: string;
  room: string;
  wall: Wall;
  pos: [number, number];
  y: number;
  min: number;
  max: number;
}

export interface Plan {
  name: string;
  wallHeight: number;
  interiorWallHeight: number;
  camera: { azimuth: number; elevation: number };
  outdoorTemp: number;
  rooms: Room[];
  openings: Opening[];
  furniture: FurnitureItem[];
  lights: PlanLight[];
  acs: PlanAC[];
  scenes: { id: string; name: string; icon: string; lights: Record<string, ScenePatch>; acs: Record<string, ScenePatch> }[];
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}

const WALLS: readonly string[] = ["north", "south", "east", "west"];

function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function normalize(raw: RawPlan): Plan {
  need(raw && Array.isArray(raw.rooms) && raw.rooms.length > 0, "Planta precisa de ao menos um cômodo");
  const ids = new Set<string>();
  const unique = (id: string, what: string): void => {
    need(typeof id === "string" && id, `${what} sem "id"`);
    need(!ids.has(id), `Id duplicado "${id}"`);
    ids.add(id);
  };

  const rooms: Room[] = raw.rooms.map((r) => {
    unique(r.id, "Cômodo");
    const [x, z, w, d] = r.rect;
    need(w > 0 && d > 0, `Cômodo "${r.id}" vazio`);
    return { id: r.id, name: r.name ?? r.id, x, z, w, d, floor: r.floor ?? "oak" };
  });
  const roomIds = new Set(rooms.map((r) => r.id));

  const openings: Opening[] = (raw.openings ?? []).map((o, i) => {
    need(o.from[0] === o.to[0] || o.from[1] === o.to[1], `Abertura #${i + 1} precisa ser alinhada aos eixos`);
    return { type: o.type ?? "door", from: o.from, to: o.to, sill: o.sill ?? 0.85, head: o.head ?? 2.1 };
  });

  const lights: PlanLight[] = (raw.lights ?? []).map((l) => {
    unique(l.id, "Luz");
    need(roomIds.has(l.room), `Luz "${l.id}" aponta para o cômodo desconhecido "${l.room}"`);
    need((LIGHT_TYPES as readonly string[]).includes(l.type), `Luz "${l.id}" com tipo desconhecido "${l.type}"`);
    return {
      ...l,
      name: l.name ?? l.id,
      type: l.type as LightType,
      rot: l.rot ?? 0,
      capabilities: (l.capabilities ?? []) as LightCap[],
    };
  });

  const acs: PlanAC[] = (raw.acs ?? []).map((a) => {
    unique(a.id, "Ar-condicionado");
    need(roomIds.has(a.room), `AC "${a.id}" aponta para o cômodo desconhecido "${a.room}"`);
    need(WALLS.includes(a.wall), `AC "${a.id}" precisa de "wall"`);
    return { id: a.id, name: a.name ?? a.id, room: a.room, wall: a.wall as Wall, pos: a.pos, y: a.y ?? 2.2, min: a.min ?? 16, max: a.max ?? 30 };
  });

  const scenes = (raw.scenes ?? []).map((s) => ({ id: s.id, name: s.name ?? s.id, icon: s.icon ?? "sun", lights: s.lights ?? {}, acs: s.acs ?? {} }));

  return {
    name: raw.name ?? "Home",
    wallHeight: raw.wallHeight ?? 2.6,
    interiorWallHeight: raw.interiorWallHeight ?? 1.25,
    camera: { azimuth: raw.camera?.azimuth ?? 34, elevation: raw.camera?.elevation ?? 47 },
    outdoorTemp: raw.outdoorTemp ?? 27,
    rooms,
    openings,
    furniture: raw.furniture ?? [],
    lights,
    acs,
    scenes,
    bounds: {
      minX: Math.min(...rooms.map((r) => r.x)),
      minZ: Math.min(...rooms.map((r) => r.z)),
      maxX: Math.max(...rooms.map((r) => r.x + r.w)),
      maxZ: Math.max(...rooms.map((r) => r.z + r.d)),
    },
  };
}
