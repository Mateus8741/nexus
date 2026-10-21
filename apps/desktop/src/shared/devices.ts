import type { ActionRequest, DeviceView, ResolvedAction } from "./types";

export type DeviceCategory = "light" | "switch" | "climate" | "computer" | "sensor" | "other";

const SWITCH_KEY = /^(switch|led_switch|switch_led)(_\d+)?$/;

export function categorize(device: DeviceView): DeviceCategory {
  if (device.capabilityKeys.includes("target-temperature-control")) return "climate";
  if (device.kind === "climate" || device.kind === "air-conditioner") return "climate";
  if (device.kind === "computer" || device.kind === "server") return "computer";
  if (device.kind === "light") return "light";
  if (device.kind === "switch") return "switch";
  if (device.kind === "sensor") return "sensor";
  return "other";
}

export function switchKey(device: DeviceView): string | undefined {
  return Object.keys(device.attributes).find((key) => SWITCH_KEY.test(key));
}

export function canPower(device: DeviceView): boolean {
  return device.actions.some((a) => a === "turn_on" || a === "turn_off" || a === "toggle");
}

export function isOn(device: DeviceView): boolean {
  if (device.status === "offline") return false;
  const category = categorize(device);
  if (category === "computer") return device.status === "online";
  if (typeof device.attributes.power === "string") return device.attributes.power === "POWER_ON";
  const key = switchKey(device);
  return key ? device.attributes[key] === true : false;
}

export function targetTemperature(device: DeviceView): number | undefined {
  const value = device.attributes.targetTemperature;
  return typeof value === "number" ? value : undefined;
}

export function currentTemperature(device: DeviceView): number | undefined {
  const value = device.attributes.currentTemperature;
  return typeof value === "number" ? value : undefined;
}

/** Aplica localmente (otimista) o efeito de uma ação, para a UI reagir sem esperar o polling. */
export function applyOptimistic(device: DeviceView, type: string, payload?: Record<string, unknown>): DeviceView {
  const attributes: Record<string, DeviceView["attributes"][string]> = { ...device.attributes };
  if (type === "set-target-temperature" && typeof payload?.value === "number") {
    attributes.targetTemperature = payload.value;
    return { ...device, attributes };
  }
  const nextOn = type === "turn_on" ? true : type === "turn_off" ? false : type === "toggle" ? !isOn(device) : undefined;
  if (nextOn === undefined) return device;
  if (typeof attributes.power === "string") attributes.power = nextOn ? "POWER_ON" : "POWER_OFF";
  else attributes[switchKey(device) ?? "switch"] = nextOn;
  return { ...device, attributes };
}

export function powerRequest(device: DeviceView, on: boolean): ActionRequest | undefined {
  if (!canPower(device)) return undefined;
  const type = on ? "turn_on" : "turn_off";
  if (device.actions.includes(type)) return { deviceId: device.id, type };
  return { deviceId: device.id, type: "toggle" };
}

/* ---------------------------------------------------------------- scenes */

export type SceneId = "bright" | "cozy" | "movie" | "night" | "away";

export interface SceneDefinition {
  readonly id: SceneId;
  readonly label: string;
  readonly icon: string;
}

export const SCENES: readonly SceneDefinition[] = [
  { id: "bright", label: "Claro", icon: "sun" },
  { id: "cozy", label: "Aconchego", icon: "sofa" },
  { id: "movie", label: "Filme", icon: "film" },
  { id: "night", label: "Noite", icon: "moon" },
  { id: "away", label: "Ausente", icon: "door" },
];

const AMBIENT = /abajur|lamp|piso|floor|mesa|backlight|fita|strip|led|tv|luminária/i;
const SCREEN_LIGHT = /tv|backlight|bias|fita|strip/i;

/**
 * Presets sobre capability power-control. Devolve só as ações necessárias
 * (dispositivos que já estão no estado desejado ficam de fora).
 */
export function planScene(scene: SceneId, devices: readonly DeviceView[]): ActionRequest[] {
  const requests: ActionRequest[] = [];
  const set = (device: DeviceView, on: boolean): void => {
    if (isOn(device) === on) return;
    const request = powerRequest(device, on);
    if (request) requests.push(request);
  };

  const lights = devices.filter((d) => ["light", "switch"].includes(categorize(d)) && canPower(d));
  const pureLights = lights.filter((d) => categorize(d) === "light");
  const anyAmbient = pureLights.some((d) => AMBIENT.test(d.name));

  for (const device of devices) {
    const category = categorize(device);
    if (device.status === "offline") continue;
    switch (scene) {
      case "bright":
        if (category === "light" || category === "switch") set(device, true);
        break;
      case "cozy":
        if (category === "light") set(device, anyAmbient ? AMBIENT.test(device.name) : true);
        break;
      case "movie":
        if (category === "light") set(device, SCREEN_LIGHT.test(device.name));
        break;
      case "night":
        if (category === "light" || category === "switch") set(device, false);
        break;
      case "away":
        if (category === "computer") {
          if (device.actions.includes("lock")) requests.push({ deviceId: device.id, type: "lock" });
        } else if (category !== "sensor") set(device, false);
        break;
    }
  }
  return requests;
}

/** Ações do dispositivo com label/schema; sem registro (demo), cai nos nomes cruas das ações. */
export function resolveActions(device: DeviceView): readonly ResolvedAction[] {
  if (device.resolved && device.resolved.length > 0) return device.resolved;
  return device.actions.map((type) => ({ capabilityKey: "", actionType: type, label: type }));
}
