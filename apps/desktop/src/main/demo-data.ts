import type { DeviceView, SpaceView } from "../shared/types";

const POWER = ["turn_on", "turn_off", "toggle"] as const;

function light(id: string, name: string, spaceId: string, on = false): DeviceView {
  return {
    id,
    name,
    kind: "light",
    providerId: "demo.tuya",
    spaceId,
    status: "online",
    attributes: { switch_led: on },
    actions: [...POWER, "set-brightness"],
    capabilityKeys: ["power-control", "brightness-control"],
  };
}

function plug(id: string, name: string, spaceId: string, on = false): DeviceView {
  return {
    id,
    name,
    kind: "switch",
    providerId: "demo.tuya",
    spaceId,
    status: "online",
    attributes: { switch_1: on },
    actions: [...POWER],
    capabilityKeys: ["power-control"],
  };
}

export const DEMO_SPACES: readonly SpaceView[] = [
  { id: "living", name: "Sala" },
  { id: "dining", name: "Jantar" },
  { id: "kitchen", name: "Cozinha" },
  { id: "bedroom", name: "Quarto" },
  { id: "bathroom", name: "Banheiro" },
];

export function createDemoDevices(): DeviceView[] {
  return [
    {
      id: "ac-living",
      name: "Ar da Sala",
      kind: "device",
      providerId: "demo.lg",
      spaceId: "living",
      status: "online",
      attributes: { power: "POWER_OFF", targetTemperature: 24, currentTemperature: 28 },
      actions: [...POWER, "set-target-temperature"],
      capabilityKeys: ["power-control", "target-temperature-control"],
    },
    light("ceiling-living", "Teto", "living"),
    plug("floor-lamp", "Abajur de piso", "living"),
    light("tv-backlight", "Backlight da TV", "living"),
    light("dining-pendant", "Pendente", "dining"),
    light("dining-strip", "Fita de LED", "dining"),
    light("kitchen-ceiling", "Teto", "kitchen"),
    plug("coffee", "Cafeteira", "kitchen"),
    light("bed-ceiling", "Teto", "bedroom"),
    light("bed-lamp", "Abajur", "bedroom"),
    {
      id: "pc-office",
      name: "PC do Escritório",
      kind: "computer",
      providerId: "nexus.windows",
      spaceId: "bedroom",
      status: "online",
      attributes: { hostname: "PC-ESCRITORIO" },
      actions: ["shutdown", "restart", "lock", "executeCommand"],
      capabilityKeys: ["power-control", "remote-command", "metrics"],
    },
  ];
}
