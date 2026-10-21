import type {
  CapabilityDefinition,
  CapabilityRegistry,
  Device,
  DeviceAttributeValue,
  ResolvedDeviceAction,
} from "@nexus/domain";
import { resolveDeviceActions } from "@nexus/domain";

/**
 * Modelo de visualização dos dispositivos. Tudo aqui é APRESENTAÇÃO: a
 * categoria só escolhe ícone/tile, e o que um dispositivo PODE fazer sempre
 * vem de `device.capabilities` (ver @nexus/domain), nunca de `kind`.
 */
export type DeviceCategory =
  | "light"
  | "plug"
  | "climate"
  | "computer"
  | "sensor"
  | "camera"
  | "other";

export interface DeviceView {
  readonly device: Device;
  readonly category: DeviceCategory;
  readonly online: boolean;
  readonly actions: readonly ResolvedDeviceAction[];
  readonly supportsPower: boolean;
  readonly isOn: boolean;
}

/** Overrides otimistas enquanto a ação roda / o próximo refresh não chega. */
export interface DevicePatch {
  readonly on?: boolean;
  readonly target?: number;
}
export type DevicePatches = Readonly<Record<string, DevicePatch>>;

const KIND_CATEGORY: Record<string, DeviceCategory> = {
  light: "light",
  switch: "plug",
  plug: "plug",
  climate: "climate",
  thermostat: "climate",
  computer: "computer",
  server: "computer",
  sensor: "sensor",
  camera: "camera",
};

const ON_VALUES = new Set(["on", "true", "power_on", "1"]);
const OFF_VALUES = new Set(["off", "false", "power_off", "0"]);

export function buildCapabilityRegistry(
  capabilities: readonly CapabilityDefinition[],
): CapabilityRegistry {
  const byKey = new Map(capabilities.map((capability) => [capability.key, capability]));
  return {
    register: () => {
      throw new Error("Registry somente leitura no client da Web.");
    },
    get: (key) => byKey.get(key),
    list: () => [...capabilities],
  };
}

/** Heurística só pra posição INICIAL de um toggle de energia — ver DeviceControls. */
export function guessPowerState(
  attributes: Readonly<Record<string, DeviceAttributeValue>>,
): boolean {
  for (const [key, value] of Object.entries(attributes)) {
    if (!/power|switch/i.test(key)) continue;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (ON_VALUES.has(normalized)) return true;
      if (OFF_VALUES.has(normalized)) return false;
    }
  }
  return false;
}

export function readNumber(
  attributes: Readonly<Record<string, DeviceAttributeValue>>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function categorize(device: Device, supportsPower: boolean): DeviceCategory {
  const byKind = KIND_CATEGORY[device.kind];
  if (byKind) return byKind;
  return supportsPower ? "plug" : "other";
}

const POWER_ACTIONS = new Set(["turn_on", "turn_off", "toggle"]);

export function buildDeviceViews(
  devices: readonly Device[],
  registry: CapabilityRegistry,
  patches: DevicePatches = {},
): DeviceView[] {
  return devices.map((device) => {
    const actions = resolveDeviceActions(device, registry);
    const supportsPower = actions.some((action) => POWER_ACTIONS.has(action.actionType));
    const patch = patches[device.id];
    const online = device.state.status === "online";
    const category = categorize(device, supportsPower);
    const isOn =
      patch?.on ??
      (supportsPower
        ? guessPowerState(device.state.attributes)
        : category === "computer" && online);
    return { device, category, online, actions, supportsPower, isOn };
  });
}

export function findAction(view: DeviceView, ...types: string[]): ResolvedDeviceAction | undefined {
  return view.actions.find((action) => types.includes(action.actionType));
}

/** Ação (e primeiro campo numérico) que ajusta a temperatura-alvo de um climatizador. */
export function findTemperatureControl(view: DeviceView) {
  const action = view.actions.find((candidate) => /temperature/i.test(candidate.actionType));
  if (!action?.payloadSchema) return undefined;
  const [field, schema] = Object.entries(action.payloadSchema)[0] ?? [];
  if (!field || !schema || typeof schema === "string" || schema.type !== "number") return undefined;
  return { action, field, min: schema.min ?? 16, max: schema.max ?? 30, step: schema.step ?? 1 };
}

export function readTargetTemperature(
  view: DeviceView,
  patches: DevicePatches = {},
): number | undefined {
  return (
    patches[view.device.id]?.target ??
    readNumber(view.device.state.attributes, ["targetTemperature", "target_temperature"])
  );
}

export function readRoomTemperature(view: DeviceView): number | undefined {
  return readNumber(view.device.state.attributes, ["currentTemperature", "current_temperature"]);
}

/** Instruções de uma mudança de energia: qual ação disparar e qual estado esperar. */
export function powerActionFor(view: DeviceView, wantOn: boolean): string | undefined {
  const direct = findAction(view, wantOn ? "turn_on" : "turn_off");
  if (direct) return direct.actionType;
  return findAction(view, "toggle")?.actionType;
}
