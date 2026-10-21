import type { CapabilityDefinition, Device, DeviceEvent } from "@nexus/domain";

import type { PluginSummaryDto, ProviderSummaryDto, SpaceDto } from "@/lib/nexus-client";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

export const demoSpaces: SpaceDto[] = [
  { id: "space.sala", name: "Sala" },
  { id: "space.quarto", name: "Quarto" },
  { id: "space.cozinha", name: "Cozinha" },
  { id: "space.escritorio", name: "Escritório" },
];

const power = [{ key: "power-control", actions: ["turn_on", "turn_off", "toggle"] }];
const dimmer = [
  { key: "power-control", actions: ["turn_on", "turn_off", "toggle"] },
  { key: "brightness-control", actions: ["set_brightness"] },
];
const system = [
  { key: "system-control", actions: ["shutdown", "restart", "lock", "executeCommand"] },
];

function light(
  id: string,
  name: string,
  spaceId: string,
  on: boolean,
  extra: Partial<Device> = {},
): Device {
  return {
    id,
    providerId: "prov.tuya",
    externalId: id,
    name,
    kind: "light",
    spaceId,
    capabilities: dimmer,
    state: {
      status: "online",
      attributes: { power: on ? "on" : "off", brightness: 80 },
      observedAt: minutesAgo(1),
    },
    ...extra,
  };
}

function plug(id: string, name: string, spaceId: string, on: boolean): Device {
  return {
    id,
    providerId: "prov.tuya",
    externalId: id,
    name,
    kind: "switch",
    spaceId,
    capabilities: power,
    state: {
      status: "online",
      attributes: { power: on ? "on" : "off" },
      observedAt: minutesAgo(2),
    },
  };
}

export const demoDevices: Device[] = [
  {
    id: "dev.ac-sala",
    providerId: "prov.lg",
    externalId: "ac-sala",
    name: "Ar-condicionado",
    kind: "climate",
    spaceId: "space.sala",
    capabilities: [
      ...power,
      { key: "target-temperature-control", actions: ["set-target-temperature"] },
    ],
    state: {
      status: "online",
      attributes: {
        power: "POWER_ON",
        currentTemperature: 27.5,
        targetTemperature: 23,
        mode: "COOL",
      },
      observedAt: minutesAgo(1),
    },
  },
  light("dev.teto-sala", "Teto", "space.sala", true),
  plug("dev.abajur", "Abajur", "space.sala", true),
  plug("dev.fita-tv", "Fita de LED da TV", "space.sala", false),
  light("dev.luz-quarto", "Luz do quarto", "space.quarto", false),
  light("dev.cabeceira", "Cabeceira", "space.quarto", false),
  light("dev.luz-cozinha", "Luz da cozinha", "space.cozinha", true),
  plug("dev.cafeteira", "Cafeteira", "space.cozinha", false),
  light("dev.luz-escritorio", "Luz do escritório", "space.escritorio", true),
  {
    id: "dev.pc-escritorio",
    providerId: "prov.windows",
    externalId: "pc-01",
    name: "PC do Escritório",
    kind: "computer",
    spaceId: "space.escritorio",
    capabilities: system,
    state: {
      status: "online",
      attributes: {
        hostname: "ESCRITORIO-PC",
        operatingSystemName: "Windows 11",
        ipAddress: "192.168.0.24",
        cpuUsagePercent: 34,
        ramUsagePercent: 61,
        diskUsagePercent: 48,
        uptimeSeconds: 61 * 3600,
      },
      observedAt: minutesAgo(1),
    },
  },
  {
    id: "dev.mac-sala",
    providerId: "prov.windows",
    externalId: "mac-01",
    name: "MacBook Pro",
    kind: "computer",
    spaceId: "space.sala",
    capabilities: system,
    state: {
      status: "online",
      attributes: {
        hostname: "macbook",
        operatingSystemName: "macOS 15",
        cpuUsagePercent: 12,
        ramUsagePercent: 72,
        diskUsagePercent: 55,
        uptimeSeconds: 9 * 3600,
      },
      observedAt: minutesAgo(1),
    },
  },
  {
    id: "dev.camera",
    providerId: "prov.tuya",
    externalId: "cam",
    name: "Câmera da entrada",
    kind: "camera",
    spaceId: "space.sala",
    capabilities: [],
    state: { status: "offline", attributes: {}, observedAt: minutesAgo(45) },
  },
];

export const demoCapabilities: CapabilityDefinition[] = [
  {
    key: "power-control",
    label: "Energia",
    actions: [
      { type: "turn_on", label: "Ligar" },
      { type: "turn_off", label: "Desligar" },
      { type: "toggle", label: "Alternar" },
    ],
  },
  {
    key: "brightness-control",
    label: "Brilho",
    actions: [
      {
        type: "set_brightness",
        label: "Brilho",
        payloadSchema: { value: { type: "number", min: 1, max: 100, step: 1, unit: "%" } },
      },
    ],
  },
  {
    key: "target-temperature-control",
    label: "Temperatura",
    actions: [
      {
        type: "set-target-temperature",
        label: "Temperatura",
        payloadSchema: { value: { type: "number", min: 16, max: 30, step: 1, unit: "°C" } },
      },
    ],
  },
  {
    key: "system-control",
    label: "Sistema",
    actions: [
      { type: "shutdown", label: "Desligar" },
      { type: "restart", label: "Reiniciar" },
      { type: "lock", label: "Bloquear" },
      { type: "executeCommand", label: "Terminal remoto" },
    ],
  },
];

export const demoEvents: DeviceEvent[] = [
  {
    type: "device.action-executed",
    deviceId: "dev.teto-sala",
    occurredAt: minutesAgo(1),
    action: { type: "turn_on" },
    result: { success: true },
  },
  {
    type: "device.state-changed",
    deviceId: "dev.ac-sala",
    occurredAt: minutesAgo(4),
    previousState: { status: "online", attributes: {}, observedAt: minutesAgo(5) },
    currentState: { status: "online", attributes: {}, observedAt: minutesAgo(4) },
  },
  { type: "device.connected", deviceId: "dev.mac-sala", occurredAt: minutesAgo(18) },
  {
    type: "device.error",
    deviceId: "dev.pc-escritorio",
    occurredAt: minutesAgo(32),
    message: "CPU acima de 90% por 5 minutos.",
  },
  {
    type: "device.disconnected",
    deviceId: "dev.camera",
    occurredAt: minutesAgo(45),
    reason: "timeout de conexão",
  },
  {
    type: "device.action-executed",
    deviceId: "dev.luz-quarto",
    occurredAt: minutesAgo(70),
    action: { type: "turn_off" },
    result: { success: true },
  },
];

export const demoProviders: ProviderSummaryDto[] = [
  { id: "prov.tuya", name: "Tuya Smart", deviceCount: 7 },
  { id: "prov.lg", name: "LG ThinQ", deviceCount: 1 },
  { id: "prov.windows", name: "Nexus Desktop", deviceCount: 2 },
];

export const demoPlugins: PluginSummaryDto[] = [
  { id: "tuya", name: "Tuya", version: "0.1.0", state: "running" },
  { id: "lg-thinq", name: "LG ThinQ", version: "0.1.0", state: "running" },
  { id: "windows", name: "Windows/Mac Agent", version: "0.1.0", state: "running" },
];

/** Linhas fictícias para as tabelas administrativas, por path do Core. */
export const demoAdminRows: Record<string, readonly Record<string, unknown>[]> = {
  "/users": [
    {
      id: "1",
      userId: "u_8f2a",
      user: "Matt",
      roleKey: "owner",
      spaceId: null,
      createdAt: minutesAgo(60 * 24 * 40).toISOString(),
    },
    {
      id: "2",
      userId: "u_c91d",
      user: "Mariana",
      roleKey: "member",
      spaceId: "space.quarto",
      createdAt: minutesAgo(60 * 24 * 12).toISOString(),
    },
  ],
  "/agents": [
    {
      id: "a1",
      agentId: "ag_pc01",
      name: "ESCRITORIO-PC",
      status: "approved",
      version: "0.1.0",
      lastConnectedAt: minutesAgo(1).toISOString(),
      lastIp: "192.168.0.24",
    },
    {
      id: "a2",
      agentId: "ag_mac01",
      name: "macbook",
      status: "approved",
      version: "0.1.0",
      lastConnectedAt: minutesAgo(2).toISOString(),
      lastIp: "192.168.0.31",
    },
  ],
  "/agents/pending": [
    {
      id: "p1",
      agentId: "ag_new77",
      name: "NOTEBOOK-SALA",
      providerHint: "windows",
      createdAt: minutesAgo(3).toISOString(),
    },
  ],
  "/api-keys": [
    {
      id: "k1",
      name: "Widget desktop",
      prefix: "nxk_9fa2",
      createdAt: minutesAgo(60 * 24 * 3).toISOString(),
      lastUsedAt: minutesAgo(2).toISOString(),
      revokedAt: null,
    },
  ],
  "/roles": [
    { id: "r1", key: "owner", name: "Owner", system: true, permissions: ["*"] },
    {
      id: "r2",
      key: "member",
      name: "Membro",
      system: true,
      permissions: ["device.read", "device.write"],
    },
  ],
  "/spaces": demoSpaces.map((space) => ({
    ...space,
    createdAt: minutesAgo(60 * 24 * 30).toISOString(),
  })),
  "/sessions": [
    {
      id: "sess_a1b2",
      expiresAt: minutesAgo(-60 * 24 * 6).toISOString(),
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0 (Macintosh)",
    },
  ],
  "/audit": [
    {
      id: "l1",
      recordedAt: minutesAgo(1).toISOString(),
      action: "device.action",
      actorType: "user",
      actorId: "u_8f2a",
      outcome: "success",
      ip: "127.0.0.1",
      metadata: { type: "turn_on" },
    },
    {
      id: "l2",
      recordedAt: minutesAgo(9).toISOString(),
      action: "auth.login",
      actorType: "user",
      actorId: "u_8f2a",
      outcome: "success",
      ip: "127.0.0.1",
      metadata: null,
    },
    {
      id: "l3",
      recordedAt: minutesAgo(40).toISOString(),
      action: "auth.failure",
      actorType: "api_key",
      actorId: "—",
      outcome: "denied",
      ip: "203.0.113.9",
      metadata: { reason: "invalid_api_key" },
    },
  ],
};
