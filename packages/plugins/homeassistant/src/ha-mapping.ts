import type { Device, DeviceAttributeValue, DeviceCapability } from "@nexus/domain";

import type { HaEntityState, HaServiceCall } from "./ha-client";

/**
 * Funções puras (sem rede) de mapeamento Home Assistant ⇄ Nexus, portadas de
 * HomeAssistantService.swift / DeviceService.swift (house-control). Ficam
 * separadas do provider para poderem ser testadas sem servidor.
 */

export const PROVIDER_ID = "nexus.homeassistant";

export type HaDomain = "light" | "switch" | "climate" | "sensor";

const UNAVAILABLE_STATES = new Set(["unavailable", "unknown"]);
const MIN_KELVIN_FALLBACK = 2000;
const MAX_KELVIN_FALLBACK = 6500;

export function entityDomain(entityId: string): string {
  const dot = entityId.indexOf(".");
  return dot < 0 ? "" : entityId.slice(0, dot);
}

// ---------------------------------------------------------------- números

/** Converte para número finito ou devolve undefined (strings numéricas aceitas, como no `double()` do Swift). */
export function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** Número obrigatório, finito, dentro de [min, max] (clampado). Lança se NaN/Infinity/ausente. */
export function requireNumber(value: unknown, min: number, max: number, field: string): number {
  const num = asFiniteNumber(value);
  if (num === undefined) {
    throw new Error(`payload.${field} precisa ser um número finito entre ${min} e ${max}.`);
  }
  return Math.min(max, Math.max(min, num));
}

/** Inteiro obrigatório (arredondado) dentro de [min, max]. */
export function requireInt(value: unknown, min: number, max: number, field: string): number {
  return Math.round(requireNumber(value, min, max, field));
}

// ---------------------------------------------------------------- vocabulário

/** Os cinco modos "do painel" e os nomes HA que cada um aceita (primeiro presente em `hvac_modes` vence). */
const PANEL_MODES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["cool", ["cool"]],
  ["heat", ["heat"]],
  ["dry", ["dry"]],
  ["fan", ["fan_only"]],
  ["auto", ["auto", "heat_cool"]],
];

/** painel → nome HA, apenas para os modos que a entidade realmente suporta. */
export function modeTable(hvacModes: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [panel, names] of PANEL_MODES) {
    const name = names.find((candidate) => hvacModes.includes(candidate));
    if (name) out[panel] = name;
  }
  return out;
}

export const FAN_ORDER = ["auto", "low", "medium", "high", "turbo"] as const;

/** Mapeia o nome de velocidade de uma plataforma para uma das cinco do painel. */
export function panelFan(name: string): string | undefined {
  const n = name.toLowerCase();
  if (["turbo", "max", "strong", "highest", "powerful", "boost", "very high"].some((t) => n.includes(t))) {
    return "turbo";
  }
  if (n.includes("high")) return "high";
  if (n.includes("med") || n.includes("mid")) return "medium";
  if (n.includes("low") || n.includes("quiet") || n.includes("silent")) return "low";
  if (n.includes("auto")) return "auto";
  return undefined;
}

/** painel → nome nativo da plataforma (o primeiro que mapeia; "off" ignorado). */
export function fanTable(names: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    if (name.toLowerCase() === "off") continue;
    const panel = panelFan(name);
    if (panel && out[panel] === undefined) out[panel] = name;
  }
  return out;
}

export function isTemperatureSensor(attributes: Readonly<Record<string, unknown>>): boolean {
  return (
    attributes.device_class === "temperature" ||
    attributes.unit_of_measurement === "°C" ||
    attributes.unit_of_measurement === "°F"
  );
}

export function isOffline(state: HaEntityState): boolean {
  return UNAVAILABLE_STATES.has(state.state);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

// ---------------------------------------------------------------- luzes

export function lightCapabilities(colorModes: readonly string[]): DeviceCapability[] {
  const caps: DeviceCapability[] = [{ key: "power-control", actions: ["turn_on", "turn_off", "toggle"] }];
  if (colorModes.some((mode) => mode !== "onoff")) {
    caps.push({ key: "brightness-control", actions: ["set-brightness"] });
  }
  if (colorModes.includes("color_temp")) {
    caps.push({ key: "color-temperature-control", actions: ["set-color-temperature"] });
  }
  if (colorModes.some((mode) => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode))) {
    caps.push({ key: "color-control", actions: ["set-color"] });
  }
  return caps;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** "#rrggbb" → [r, g, b] inteiros 0-255, ou undefined. */
export function hexToRgb(hex: string): [number, number, number] | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const value = Number.parseInt(match[1] as string, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function kelvinRange(attributes: Readonly<Record<string, unknown>>): { min: number; max: number } {
  const min = asFiniteNumber(attributes.min_color_temp_kelvin) ?? MIN_KELVIN_FALLBACK;
  const max = asFiniteNumber(attributes.max_color_temp_kelvin) ?? MAX_KELVIN_FALLBACK;
  return max > min ? { min: Math.round(min), max: Math.round(max) } : { min: MIN_KELVIN_FALLBACK, max: MAX_KELVIN_FALLBACK };
}

// ---------------------------------------------------------------- Entidade → Device

/** Atributos (JSON-safe) a partir do estado bruto da entidade. */
export function mapAttributes(state: HaEntityState): Record<string, DeviceAttributeValue> {
  const a = state.attributes;
  const domain = entityDomain(state.entity_id);
  const out: Record<string, DeviceAttributeValue> = { entityDomain: domain };
  if (isOffline(state)) return out;

  if (domain === "light" || domain === "switch") {
    out.on = state.state === "on";
    if (domain === "light") {
      const brightness = asFiniteNumber(a.brightness);
      if (state.state === "on" && brightness !== undefined) {
        out.brightness = Math.max(1, Math.min(100, Math.round((brightness / 255) * 100)));
      }
      const colorMode = typeof a.color_mode === "string" ? a.color_mode : undefined;
      if (colorMode === "color_temp") {
        const kelvin = asFiniteNumber(a.color_temp_kelvin);
        if (kelvin !== undefined) {
          const range = kelvinRange(a);
          const clamped = Math.min(range.max, Math.max(range.min, kelvin));
          out.colorTemperatureKelvin = Math.round(clamped);
          out.colorTemperature = Math.round(((clamped - range.min) / (range.max - range.min)) * 100);
        }
      } else if (colorMode && ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(colorMode)) {
        const rgb = Array.isArray(a.rgb_color) ? a.rgb_color.map(asFiniteNumber) : [];
        if (rgb.length === 3 && rgb.every((n) => n !== undefined)) {
          out.color = rgbToHex(rgb[0] as number, rgb[1] as number, rgb[2] as number);
        }
      }
    }
  } else if (domain === "climate") {
    const hvacModes = strings(a.hvac_modes);
    const modes = modeTable(hvacModes);
    out.on = state.state !== "off";
    out.hvacModeRaw = state.state;
    const panel = Object.entries(modes).find(([, name]) => name === state.state)?.[0];
    if (panel) out.hvacMode = panel;
    const target = asFiniteNumber(a.temperature);
    const low = asFiniteNumber(a.target_temp_low);
    const high = asFiniteNumber(a.target_temp_high);
    if (target !== undefined) out.targetTemperature = target;
    else if (low !== undefined && high !== undefined) out.targetTemperature = Math.round((low + high) / 2);
    const room = asFiniteNumber(a.current_temperature);
    if (room !== undefined) out.currentTemperature = room;
    const fans = fanTable(strings(a.fan_modes));
    if (typeof a.fan_mode === "string") {
      const fan = panelFan(a.fan_mode);
      if (fan && fans[fan] !== undefined) out.fanMode = fan;
    }
    const swings = strings(a.swing_modes);
    if (typeof a.swing_mode === "string" && swings.length > 0) {
      out.swing = a.swing_mode !== "off";
    }
    out.supportedHvacModes = JSON.stringify(Object.keys(modes));
    out.supportedFanModes = JSON.stringify(FAN_ORDER.filter((fan) => fans[fan] !== undefined));
  } else if (domain === "sensor") {
    const raw = asFiniteNumber(state.state);
    if (raw !== undefined) {
      out.temperature = a.unit_of_measurement === "°F" ? ((raw - 32) * 5) / 9 : raw;
    }
  }
  return out;
}

/** Converte uma entidade HA em Device Nexus; undefined para domínios não suportados. */
export function mapEntityToDevice(
  state: HaEntityState,
  options: { readonly spaceId?: string; readonly area?: string; readonly now?: Date } = {},
): Device | undefined {
  const domain = entityDomain(state.entity_id);
  const a = state.attributes;
  const name = typeof a.friendly_name === "string" && a.friendly_name ? a.friendly_name : state.entity_id;

  let kind: string;
  let capabilities: DeviceCapability[];
  switch (domain) {
    case "light":
      kind = "light";
      capabilities = lightCapabilities(strings(a.supported_color_modes));
      break;
    case "switch":
      kind = "switch";
      capabilities = [{ key: "power-control", actions: ["turn_on", "turn_off", "toggle"] }];
      break;
    case "climate": {
      kind = "climate";
      const modes = modeTable(strings(a.hvac_modes));
      const fans = fanTable(strings(a.fan_modes));
      capabilities = [
        { key: "power-control", actions: ["turn_on", "turn_off", "toggle"] },
        ...(Object.keys(modes).length > 0
          ? [{ key: "hvac-mode-control", actions: ["set-mode"] } satisfies DeviceCapability]
          : []),
        { key: "target-temperature-control", actions: ["set-target-temperature"] },
        ...(Object.keys(fans).length > 0
          ? [{ key: "fan-speed-control", actions: ["set-fan-speed"] } satisfies DeviceCapability]
          : []),
        ...(strings(a.swing_modes).length > 0
          ? [{ key: "swing-control", actions: ["set-swing"] } satisfies DeviceCapability]
          : []),
      ];
      break;
    }
    case "sensor":
      if (!isTemperatureSensor(a)) return undefined;
      kind = "sensor";
      capabilities = [];
      break;
    default:
      return undefined;
  }
  capabilities.push({ key: "telemetry" });

  const attributes = mapAttributes(state);
  if (options.area) attributes.area = options.area;

  return {
    id: state.entity_id,
    providerId: PROVIDER_ID,
    externalId: state.entity_id,
    name,
    kind,
    capabilities,
    spaceId: options.spaceId,
    state: {
      status: isOffline(state) ? "offline" : "online",
      attributes,
      observedAt: options.now ?? new Date(),
    },
  };
}

// ---------------------------------------------------------------- Ação → chamadas de serviço

/** Primeiro modo "ligado" a usar quando um climate está desligado e recebe turn_on. */
const TURN_ON_PREFERENCE = ["cool", "auto", "heat", "fan", "dry"] as const;

const MODE_ALIASES: Record<string, string> = {
  cool: "cool",
  heat: "heat",
  dry: "dry",
  air_dry: "dry",
  fan: "fan",
  fan_only: "fan",
  auto: "auto",
  heat_cool: "auto",
};

/**
 * Traduz uma ação Nexus em chamadas de serviço do HA, validando todo número
 * (finito, inteiro onde a API espera inteiro) antes de enviar.
 * Lança `Error` com mensagem em português para ação/payload inválidos.
 */
export function buildServiceCalls(
  state: HaEntityState,
  action: { readonly type: string; readonly payload?: Readonly<Record<string, unknown>> },
): HaServiceCall[] {
  const id = state.entity_id;
  const domain = entityDomain(id);
  const a = state.attributes;
  const payload = action.payload ?? {};
  const call = (service: string, data: Record<string, unknown> = {}, d: string = domain): HaServiceCall => ({
    domain: d,
    service,
    data: { entity_id: id, ...data },
  });
  const isOn = domain === "climate" ? state.state !== "off" : state.state === "on";

  if (domain !== "light" && domain !== "switch" && domain !== "climate") {
    throw new Error(`Entidade "${id}" não é controlável pelo provider Home Assistant.`);
  }

  if (action.type === "turn_off") return [call(domain === "climate" ? "set_hvac_mode" : "turn_off", domain === "climate" ? { hvac_mode: "off" } : {})];
  const wantsOn = action.type === "turn_on" || (action.type === "toggle" && !isOn);
  if (action.type === "toggle" && isOn) {
    return [call(domain === "climate" ? "set_hvac_mode" : "turn_off", domain === "climate" ? { hvac_mode: "off" } : {})];
  }

  if (domain === "switch") {
    if (wantsOn) return [call("turn_on")];
    throw new Error(`Ação "${action.type}" não é suportada por um switch.`);
  }

  if (domain === "light") {
    if (wantsOn) return [call("turn_on")];
    const supported = strings(a.supported_color_modes);
    if (action.type === "set-brightness") {
      if (!supported.some((mode) => mode !== "onoff")) throw new Error("A luz não suporta brilho.");
      const pct = requireInt(payload.value, 0, 100, "value");
      return pct === 0 ? [call("turn_off")] : [call("turn_on", { brightness_pct: pct })];
    }
    if (action.type === "set-color-temperature") {
      if (!supported.includes("color_temp")) throw new Error("A luz não suporta temperatura de cor.");
      const range = kelvinRange(a);
      const direct = asFiniteNumber(payload.kelvin);
      const kelvin =
        direct !== undefined
          ? Math.round(Math.min(range.max, Math.max(range.min, direct)))
          : Math.round(
              range.min + (requireNumber(payload.value, 0, 100, "value") / 100) * (range.max - range.min),
            );
      return [call("turn_on", { color_temp_kelvin: kelvin })];
    }
    if (action.type === "set-color") {
      if (!supported.some((mode) => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode))) {
        throw new Error("A luz não suporta cor.");
      }
      if (payload.hex !== undefined || payload.r !== undefined) {
        const rgb =
          typeof payload.hex === "string"
            ? hexToRgb(payload.hex)
            : ([
                requireInt(payload.r, 0, 255, "r"),
                requireInt(payload.g, 0, 255, "g"),
                requireInt(payload.b, 0, 255, "b"),
              ] as [number, number, number]);
        if (!rgb) throw new Error("payload.hex precisa estar no formato #rrggbb.");
        return [call("turn_on", { rgb_color: rgb })];
      }
      const h = requireNumber(payload.h, 0, 360, "h");
      const s = requireNumber(payload.s, 0, 100, "s");
      const v = requireInt(payload.v, 0, 100, "v");
      const data: Record<string, unknown> = { hs_color: [Math.round(h), Math.round(s)] };
      if (v > 0) data.brightness_pct = v;
      return [call("turn_on", data)];
    }
    throw new Error(`Ação "${action.type}" não é suportada por uma luz.`);
  }

  // climate
  const hvacModes = strings(a.hvac_modes);
  const modes = modeTable(hvacModes);
  const turnOnCall = (): HaServiceCall => {
    const panel = TURN_ON_PREFERENCE.find((mode) => modes[mode] !== undefined);
    const name = panel ? modes[panel] : hvacModes.find((mode) => mode !== "off");
    if (!name) throw new Error("O climate não expõe nenhum modo de operação além de desligado.");
    return call("set_hvac_mode", { hvac_mode: name });
  };

  if (wantsOn) return [turnOnCall()];

  if (action.type === "set-mode") {
    const requested = String(payload.mode ?? payload.value ?? "").toLowerCase();
    const panel = MODE_ALIASES[requested];
    const name = panel ? modes[panel] : hvacModes.includes(requested) ? requested : undefined;
    if (!name) {
      throw new Error(`Modo "${requested}" não é suportado (disponíveis: ${hvacModes.join(", ") || "nenhum"}).`);
    }
    return [call("set_hvac_mode", { hvac_mode: name })];
  }
  if (action.type === "set-target-temperature") {
    const lo = asFiniteNumber(a.min_temp) ?? 7;
    const hi = asFiniteNumber(a.max_temp) ?? 35;
    const step = Math.max(0.1, asFiniteNumber(a.target_temp_step) ?? 0.5);
    const raw = requireNumber(payload.value, Math.min(lo, hi), Math.max(lo, hi), "value");
    // Arredonda ao passo suportado (inteiro quando o passo é >= 1); ainda finito pois step > 0.
    const rounded = Math.round(raw / step) * step;
    const temperature = Math.round(rounded * 10) / 10;
    return [call("set_temperature", { temperature })];
  }
  if (action.type === "set-fan-speed") {
    const requested = String(payload.value ?? "");
    const fans = fanTable(strings(a.fan_modes));
    const wanted = fans[panelFan(requested) ?? ""] ?? strings(a.fan_modes).find((n) => n === requested);
    if (!wanted) throw new Error(`Velocidade "${requested}" não é suportada por este climate.`);
    return [call("set_fan_mode", { fan_mode: wanted })];
  }
  if (action.type === "set-swing") {
    if (typeof payload.value !== "boolean") throw new Error('Ação "set-swing" exige payload.value (boolean).');
    const swings = strings(a.swing_modes);
    if (swings.length === 0) throw new Error("O climate não suporta oscilação.");
    const onName = swings.includes("on") ? "on" : (swings.find((n) => n !== "off") as string);
    return [call("set_swing_mode", { swing_mode: payload.value ? onName : "off" })];
  }
  throw new Error(`Ação "${action.type}" não é suportada por um climate.`);
}
