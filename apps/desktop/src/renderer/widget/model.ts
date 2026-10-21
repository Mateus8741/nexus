// Ponte entre o modelo do Nexus (DeviceView/SpaceView) e o modelo do house-control (luzes, ACs, cômodos).
//
// Regra de ouro: a UI só oferece o que as capabilities do dispositivo permitem. Nada de controle
// inventado. Os vínculos entre dispositivos e a planta 3D são por cômodo + nome; o que não casa
// continua aparecendo nos tiles, mas fica sem representação (ou decorativo) no modelo 3D.
import { canPower, categorize, currentTemperature, isOn, powerRequest, resolveActions, targetTemperature } from "../../shared/devices";
import type { ActionRequest, AttributeValue, DeviceView, FieldSchema, ResolvedAction, SpaceView } from "../../shared/types";
import { MODE_COLORS, type AcMode } from "./home/ac";
import { lightColor } from "./home/lights";
import type { LightType, Plan, ScenePatch } from "./home/plan";
import { hexToHsv, hsvToHex } from "./ui";

/* ------------------------------------------------------------------ luzes */

/** Nomes que indicam lâmpada mesmo quando o dispositivo é uma tomada (kind "switch"). */
const LAMP_NAME = /abajur|lamp|luz\b|luzes|lumin|pendente|pendant|fita|strip|backlight|teto|ceiling|spot|light/i;

export type DeviceTile = "light" | "ac" | "other";

/** Tipo de tile na UI. Sensores não viram tile. */
export function tileKind(d: DeviceView): DeviceTile | undefined {
  switch (categorize(d)) {
    case "light":
    case "switch":
      return "light";
    case "climate":
      return "ac";
    case "computer":
    case "other":
      return d.actions.length > 0 ? "other" : undefined;
    default:
      return undefined;
  }
}

/** Lâmpada de verdade: entra na contagem "N de M luzes", em "All on/off" e nas cenas. */
export function isLamp(d: DeviceView): boolean {
  const c = categorize(d);
  return c === "light" || (c === "switch" && LAMP_NAME.test(d.name));
}

export interface LampCaps {
  power: boolean;
  brightness: boolean;
  temp: boolean;
  /** Formato da ação de cor, quando existe. */
  color?: "hsv";
}

const hasAction = (d: DeviceView, type: string): boolean => d.actions.includes(type);

export function lampCaps(d: DeviceView): LampCaps {
  const colorAction = resolveActions(d).find((a) => a.actionType === "set-color");
  const schema = colorAction?.payloadSchema;
  const hsv = !schema || ["h", "s", "v"].every((k) => k in schema); // demo: sem schema, assume o contrato Tuya
  return {
    power: canPower(d),
    brightness: hasAction(d, "set-brightness"),
    temp: hasAction(d, "set-color-temperature"),
    color: colorAction && hsv ? "hsv" : undefined,
  };
}

export const hasSheet = (caps: LampCaps): boolean => caps.brightness || caps.temp || Boolean(caps.color);

const KELVIN_MIN = 2200;
const KELVIN_MAX = 6500;

export interface LightState {
  on: boolean;
  /** 0..1; 1 quando o dispositivo não reporta/regula brilho. */
  brightness: number;
  temp: number;
  color: string | null;
}

function num(d: DeviceView, codes: string[]): { value: number; v2: boolean } | undefined {
  for (const code of codes) {
    const raw = d.attributes[code];
    if (typeof raw === "number") return { value: raw, v2: code.endsWith("_v2") };
  }
  return undefined;
}

function readHsv(d: DeviceView): { h: number; s: number; v: number } | undefined {
  for (const key of ["colour_data_v2", "colour_data"]) {
    const raw = d.attributes[key];
    let parsed: { h?: number; s?: number; v?: number } | undefined;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        continue;
      }
    }
    if (parsed && typeof parsed.h === "number" && typeof parsed.s === "number" && typeof parsed.v === "number") {
      const max = key.endsWith("_v2") ? 1000 : 255;
      return { h: parsed.h, s: parsed.s / max, v: parsed.v / max };
    }
  }
  return undefined;
}

export function lightState(d: DeviceView): LightState {
  const caps = lampCaps(d);
  const on = isOn(d);
  const colourMode = d.attributes.work_mode === "colour";
  const hsv = caps.color && colourMode ? readHsv(d) : undefined;
  let brightness = 1;
  if (hsv) brightness = hsv.v;
  else if (caps.brightness) {
    const b = num(d, ["bright_value_v2", "bright_value"]);
    if (b) brightness = b.value / (b.v2 ? 1000 : 255);
  }
  const t = caps.temp ? num(d, ["temp_value_v2", "temp_value"]) : undefined;
  const temp = t ? KELVIN_MIN + (t.value / (t.v2 ? 1000 : 255)) * (KELVIN_MAX - KELVIN_MIN) : 3000;
  return {
    on,
    brightness: Math.min(1, Math.max(0.05, brightness)),
    temp,
    color: hsv ? hsvToHex(hsv.h, hsv.s, 1) : null,
  };
}

/** O que o modelo 3D desenha para uma lâmpada. */
export function lightVisual(d: DeviceView): { level: number; temp: number; color: string | null } {
  const s = lightState(d);
  const caps = lampCaps(d);
  return { level: s.on ? (caps.brightness ? s.brightness : 1) : 0, temp: s.temp, color: s.color };
}

/** Cor da luz como #hex (para o --c dos tiles). */
export function lightCss(s: LightState): string {
  return `#${lightColor({ temp: s.temp, color: s.color }).getHexString()}`;
}

export interface LightPatch {
  on?: boolean;
  brightness?: number;
  temp?: number;
  color?: string | null;
}

const pct = (n: number): number => Math.round(Math.min(100, Math.max(0, n)));

/** Converte uma alteração desejada nas ações que o dispositivo realmente aceita. */
export function lightRequests(d: DeviceView, patch: LightPatch): ActionRequest[] {
  const caps = lampCaps(d);
  const s = lightState(d);
  const out: ActionRequest[] = [];
  const wantOn = patch.on ?? (patch.brightness !== undefined || patch.temp !== undefined || patch.color ? true : s.on);
  if (wantOn !== s.on) {
    const power = powerRequest(d, wantOn);
    if (power) out.push(power);
  }
  if (!wantOn) return out;

  const brightness = patch.brightness !== undefined ? Math.min(1, Math.max(0.05, patch.brightness)) : s.brightness;
  const colorWanted = patch.color !== undefined ? patch.color : patch.temp !== undefined ? null : s.color;

  if (colorWanted && caps.color) {
    const c = hexToHsv(colorWanted);
    if (c && (patch.color !== undefined || patch.brightness !== undefined)) {
      out.push({ deviceId: d.id, type: "set-color", payload: { h: Math.round(c.h), s: pct(c.s * 100), v: pct(brightness * 100) } });
    }
    return out;
  }
  if (patch.temp !== undefined && caps.temp) {
    out.push({ deviceId: d.id, type: "set-color-temperature", payload: { value: pct(((patch.temp - KELVIN_MIN) / (KELVIN_MAX - KELVIN_MIN)) * 100) } });
  }
  if (patch.brightness !== undefined && caps.brightness) {
    out.push({ deviceId: d.id, type: "set-brightness", payload: { value: pct(brightness * 100) } });
  }
  return out;
}

/* ------------------------------------------------------------------ AC */

export interface AcOption {
  action: string;
  field: string;
  values: string[];
}
export interface AcToggle {
  action: string;
  field?: string;
}
export interface AcCaps {
  power: boolean;
  target: boolean;
  min: number;
  max: number;
  mode?: AcOption;
  fan?: AcOption;
  swing?: AcOption;
  sleep?: AcToggle;
  eco?: AcToggle;
}

const fieldType = (s: FieldSchema): string => (typeof s === "string" ? s : s.type);

function singleField(a: ResolvedAction): [string, FieldSchema] | undefined {
  const entries = Object.entries(a.payloadSchema ?? {});
  return entries.length === 1 ? (entries[0] as [string, FieldSchema]) : undefined;
}

function optionOf(a: ResolvedAction): AcOption | undefined {
  const f = singleField(a);
  if (!f || typeof f[1] === "string" || f[1].type !== "string" || !f[1].options?.length) return undefined;
  return { action: a.actionType, field: f[0], values: [...f[1].options] };
}

function toggleOf(a: ResolvedAction): AcToggle | undefined {
  const entries = Object.entries(a.payloadSchema ?? {});
  if (entries.length === 0) return { action: a.actionType };
  const f = singleField(a);
  return f && fieldType(f[1]) === "boolean" ? { action: a.actionType, field: f[0] } : undefined;
}

/** Só devolve o que o dispositivo declara. Sem schema resolvido (modo demo) só há ligar/alvo. */
export function acCaps(d: DeviceView): AcCaps {
  const caps: AcCaps = { power: canPower(d), target: hasAction(d, "set-target-temperature"), min: 16, max: 30 };
  const target = resolveActions(d).find((a) => a.actionType === "set-target-temperature");
  const t = target?.payloadSchema?.value;
  if (t && typeof t !== "string" && t.type === "number") {
    if (t.min !== undefined) caps.min = t.min;
    if (t.max !== undefined) caps.max = t.max;
  }
  for (const a of d.resolved ?? []) {
    const key = `${a.actionType} ${a.label}`;
    if (/sleep|dormir|sono/i.test(key)) caps.sleep ??= toggleOf(a);
    else if (/eco/i.test(key)) caps.eco ??= toggleOf(a);
    else if (/swing|airflow|louver|vane|fluxo/i.test(key)) caps.swing ??= optionOf(a);
    else if (/fan|wind|vent/i.test(key)) caps.fan ??= optionOf(a);
    else if (/mode|modo/i.test(key)) caps.mode ??= optionOf(a);
  }
  return caps;
}

export interface AcState {
  on: boolean;
  target: number;
  roomTemp?: number;
  mode?: string;
  fan?: string;
  swing?: string;
  sleep: boolean;
  eco: boolean;
}

const str = (v: AttributeValue | undefined): string | undefined => (typeof v === "string" && v ? v : undefined);

function attr(d: DeviceView, keys: (string | undefined)[]): AttributeValue | undefined {
  for (const k of keys) if (k && k in d.attributes) return d.attributes[k];
  return undefined;
}

export function acState(d: DeviceView): AcState {
  const caps = acCaps(d);
  const snake = (a?: string): string | undefined => a?.replace(/^set[-_]/, "").replace(/-/g, "_");
  return {
    on: isOn(d),
    target: targetTemperature(d) ?? 24,
    roomTemp: currentTemperature(d),
    mode: str(attr(d, [caps.mode?.field, snake(caps.mode?.action), "mode", "workMode"])),
    fan: str(attr(d, [caps.fan?.field, snake(caps.fan?.action), "fan", "fanSpeed", "fan_speed"])),
    swing: str(attr(d, [caps.swing?.field, snake(caps.swing?.action), "swing"])),
    sleep: attr(d, [caps.sleep?.field, snake(caps.sleep?.action), "sleep"]) === true,
    eco: attr(d, [caps.eco?.field, snake(caps.eco?.action), "eco"]) === true,
  };
}

/** Modo normalizado para cor/ícone; desconhecido cai em "cool" (o modo padrão do desenho). */
export function acModeKey(mode: string | undefined): AcMode {
  const m = mode?.toLowerCase() ?? "";
  if (/heat|quente|aquec/.test(m)) return "heat";
  if (/dry|seco|desum/.test(m)) return "dry";
  if (/fan|vent/.test(m)) return "fan";
  if (/auto/.test(m)) return "auto";
  return "cool";
}

export const acColor = (s: AcState): string => MODE_COLORS[acModeKey(s.mode)];

export interface AcPatch {
  on?: boolean;
  target?: number;
  mode?: string;
  fan?: string;
  swing?: string;
  sleep?: boolean;
  eco?: boolean;
}

export function acRequests(d: DeviceView, patch: AcPatch): ActionRequest[] {
  const caps = acCaps(d);
  const s = acState(d);
  const out: ActionRequest[] = [];
  const wantOn = patch.on ?? (patch.target !== undefined || patch.mode !== undefined ? true : s.on);
  if (wantOn !== s.on) {
    const power = powerRequest(d, wantOn);
    if (power) out.push(power);
  }
  if (!wantOn) return out;
  if (patch.target !== undefined && caps.target) {
    out.push({ deviceId: d.id, type: "set-target-temperature", payload: { value: Math.min(caps.max, Math.max(caps.min, Math.round(patch.target))) } });
  }
  const option = (o: AcOption | undefined, v: string | undefined): void => {
    if (o && v !== undefined) out.push({ deviceId: d.id, type: o.action, payload: { [o.field]: v } });
  };
  option(caps.mode, patch.mode);
  option(caps.fan, patch.fan);
  option(caps.swing, patch.swing);
  const toggle = (t: AcToggle | undefined, v: boolean | undefined): void => {
    if (t && v !== undefined) out.push({ deviceId: d.id, type: t.action, ...(t.field ? { payload: { [t.field]: v } } : {}) });
  };
  toggle(caps.sleep, patch.sleep);
  toggle(caps.eco, patch.eco);
  return out;
}

/* ------------------------------------------------------------- vínculo 3D */

const ROOM_BY_NAME: [string, RegExp][] = [
  ["living", /sala|living|estar|lounge/i],
  ["dining", /jantar|dining|varanda/i],
  ["kitchen", /cozinha|kitchen/i],
  ["bedroom", /quarto|bed|su[ií]te|dormit/i],
  ["bath", /banheiro|bath|wc|lavabo/i],
];

/** Cômodo da planta que corresponde a um espaço do Nexus (pelo nome). */
export function planRoomOf(spaceName: string, plan: Plan): string | undefined {
  const exact = plan.rooms.find((r) => r.name.toLowerCase() === spaceName.toLowerCase() || r.id === spaceName.toLowerCase());
  if (exact) return exact.id;
  return ROOM_BY_NAME.find(([id, re]) => re.test(spaceName) && plan.rooms.some((r) => r.id === id))?.[0];
}

/** Dica do tipo de luminária a partir do nome do dispositivo. */
export function fixtureHint(name: string): LightType | undefined {
  if (/pendente|pendant|lustre/i.test(name)) return "pendant";
  if (/spot|embutid/i.test(name)) return "spots";
  if (/piso|floor|coluna/i.test(name)) return "floor";
  if (/fita|strip|backlight|\btv\b|barra|espelho|mirror|balc[aã]o|\bled\b/i.test(name)) return "strip";
  if (/abajur|mesa|table|cabeceira|criado|bedside|lamp\b/i.test(name)) return "table";
  if (/teto|ceiling|plaf/i.test(name)) return "ceiling";
  return undefined;
}

const PREFERRED: Record<LightType, LightType[]> = {
  ceiling: ["ceiling", "spots", "pendant"],
  pendant: ["pendant", "ceiling"],
  spots: ["spots", "ceiling"],
  floor: ["floor", "table"],
  table: ["table", "floor"],
  strip: ["strip"],
};

export interface Binding {
  /** id do dispositivo -> id da luz da planta. */
  light: Map<string, string>;
  /** id do dispositivo -> id do AC da planta. */
  ac: Map<string, string>;
  /** id do espaço -> id do cômodo da planta. */
  room: Map<string, string>;
}

/** Vincula dispositivos a luzes/ACs da planta: mesmo cômodo, tipo pelo nome, sem repetir. */
export function bindDevices(devices: readonly DeviceView[], spaces: readonly SpaceView[], plan: Plan): Binding {
  const room = new Map<string, string>();
  for (const s of spaces) {
    const id = planRoomOf(s.name, plan);
    if (id) room.set(s.id, id);
  }
  const light = new Map<string, string>();
  const ac = new Map<string, string>();

  const pairs: { score: number; order: number; device: string; plan: string }[] = [];
  let order = 0;
  for (const d of devices) {
    const r = d.spaceId ? room.get(d.spaceId) : undefined;
    if (!r) continue;
    if (tileKind(d) === "light" && isLamp(d)) {
      const hint = fixtureHint(d.name);
      for (const pl of plan.lights.filter((l) => l.room === r)) {
        const score = hint ? 3 - PREFERRED[hint].indexOf(pl.type) : 0.5;
        if (hint && !PREFERRED[hint].includes(pl.type)) continue;
        pairs.push({ score, order: order++, device: d.id, plan: pl.id });
      }
    } else if (tileKind(d) === "ac") {
      for (const pa of plan.acs.filter((a) => a.room === r)) pairs.push({ score: 1, order: order++, device: d.id, plan: pa.id });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.order - b.order);
  const usedPlan = new Set<string>();
  for (const p of pairs) {
    if (usedPlan.has(p.plan) || light.has(p.device) || ac.has(p.device)) continue;
    usedPlan.add(p.plan);
    if (plan.lights.some((l) => l.id === p.plan)) light.set(p.device, p.plan);
    else ac.set(p.device, p.plan);
  }
  return { light, ac, room };
}

/* ------------------------------------------------------------------ cenas */

/**
 * Plano de uma cena como lista de ações do Core. Cada lâmpada usa o patch da cena para a luz da planta a que
 * está vinculada (ou o curinga "*"); só vão ações que o dispositivo suporta e que mudam algo.
 */
export function sceneRequests(sceneId: string, devices: readonly DeviceView[], binding: Binding, plan: Plan): ActionRequest[] {
  const scene = plan.scenes.find((s) => s.id === sceneId);
  if (!scene) return [];
  const requests: ActionRequest[] = [];
  for (const d of devices) {
    if (d.status === "offline") continue;
    const kind = tileKind(d);
    if (kind === "light" && isLamp(d)) {
      const planId = binding.light.get(d.id);
      const patch: ScenePatch = { ...(scene.lights["*"] ?? {}), ...(planId ? (scene.lights[planId] ?? {}) : {}) };
      if (!("color" in patch) && "temp" in patch) patch.color = null;
      const s = lightState(d);
      const caps = lampCaps(d);
      const wanted: LightPatch = { on: patch.on };
      if (patch.on !== false) {
        if (patch.brightness !== undefined && caps.brightness && Math.abs(patch.brightness - s.brightness) > 0.02) wanted.brightness = patch.brightness;
        if (patch.temp !== undefined && caps.temp && Math.abs(patch.temp - s.temp) > 120) wanted.temp = patch.temp;
        if (patch.color && caps.color && patch.color.toLowerCase() !== s.color?.toLowerCase()) wanted.color = patch.color;
      }
      if (wanted.on === undefined && wanted.brightness === undefined && wanted.temp === undefined && wanted.color === undefined) continue;
      requests.push(...lightRequests(d, wanted));
    } else if (kind === "ac") {
      const planId = binding.ac.get(d.id);
      const patch: ScenePatch = { ...(scene.acs["*"] ?? {}), ...(planId ? (scene.acs[planId] ?? {}) : {}) };
      if (patch.on === undefined && patch.target === undefined && patch.sleep === undefined) continue;
      const wanted: AcPatch = {};
      if (patch.on !== undefined) wanted.on = patch.on;
      if (patch.target !== undefined) wanted.target = patch.target;
      if (patch.sleep !== undefined) wanted.sleep = patch.sleep;
      requests.push(...acRequests(d, wanted));
    }
  }
  return requests;
}
