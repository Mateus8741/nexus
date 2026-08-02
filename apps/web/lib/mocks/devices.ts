import type { Device } from "@nexus/domain";

/**
 * Dispositivos mockados, moldados com os tipos reais de @nexus/domain
 * (Device/DeviceState). Existem só para o Dashboard ter algo para exibir —
 * nenhum DeviceProvider real está conectado, nenhuma API é chamada.
 */

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

export const mockDevices: Device[] = [
  {
    id: "dev.light-sala",
    providerId: "prov.mock",
    externalId: "light.sala_principal",
    name: "Luz da Sala",
    kind: "light",
    spaceId: "space.casa-sala",
    capabilities: [{ key: "on-off", actions: ["turn_on", "turn_off"] }, { key: "brightness" }],
    state: {
      status: "online",
      attributes: { power: "on", brightness: 78 },
      observedAt: minutesAgo(2),
    },
  },
  {
    id: "dev.thermostat-sala",
    providerId: "prov.mock",
    externalId: "climate.sala",
    name: "Termostato da Sala",
    kind: "thermostat",
    spaceId: "space.casa-sala",
    capabilities: [{ key: "temperature-control", actions: ["set_temperature"] }],
    state: {
      status: "online",
      attributes: { target_temperature: 22, current_temperature: 23.4 },
      observedAt: minutesAgo(5),
    },
  },
  {
    id: "dev.sensor-presenca-sala",
    providerId: "prov.mock",
    externalId: "binary_sensor.presenca_sala",
    name: "Sensor de Presença",
    kind: "sensor",
    spaceId: "space.casa-sala",
    capabilities: [{ key: "presence-sensor" }],
    state: { status: "online", attributes: { presence: true }, observedAt: minutesAgo(1) },
  },
  {
    id: "dev.desktop-escritorio",
    providerId: "prov.mock",
    externalId: "pc.escritorio-01",
    name: "Desktop do Escritório",
    kind: "computer",
    spaceId: "space.casa-escritorio",
    capabilities: [{ key: "power-control", actions: ["shutdown", "wake_on_lan"] }],
    state: {
      status: "online",
      attributes: { cpu_usage: 34, uptime_hours: 61 },
      observedAt: minutesAgo(3),
    },
  },
  {
    id: "dev.impressora-escritorio",
    providerId: "prov.mock",
    externalId: "printer.escritorio",
    name: "Impressora",
    kind: "printer",
    spaceId: "space.casa-escritorio",
    capabilities: [{ key: "on-off" }],
    state: { status: "offline", attributes: { power: "off" }, observedAt: minutesAgo(180) },
  },
  {
    id: "dev.camera-entrada",
    providerId: "prov.mock",
    externalId: "camera.entrada",
    name: "Câmera da Entrada",
    kind: "camera",
    spaceId: "space.casa-sala",
    capabilities: [{ key: "video-stream" }],
    state: { status: "unknown", attributes: {}, observedAt: minutesAgo(45) },
  },
  {
    id: "dev.server-rack-a-01",
    providerId: "prov.mock",
    externalId: "srv-rack-a-01",
    name: "srv-rack-a-01",
    kind: "server",
    spaceId: "space.datacenter-rack-a",
    capabilities: [{ key: "power-control", actions: ["restart", "shutdown"] }],
    state: {
      status: "online",
      attributes: { cpu_usage: 92, memory_usage: 74 },
      observedAt: minutesAgo(1),
    },
  },
  {
    id: "dev.switch-rack-a",
    providerId: "prov.mock",
    externalId: "switch-rack-a",
    name: "Switch de Rede",
    kind: "network-switch",
    spaceId: "space.datacenter-rack-a",
    capabilities: [{ key: "port-monitoring" }],
    state: {
      status: "online",
      attributes: { ports_up: 22, ports_total: 24 },
      observedAt: minutesAgo(4),
    },
  },
];
