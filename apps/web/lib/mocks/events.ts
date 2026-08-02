import type { DeviceEvent } from "@nexus/domain";

/**
 * Eventos mockados, moldados com o tipo real DeviceEvent de @nexus/domain.
 * Só para popular o feed de atividade do Dashboard — nenhum DeviceProvider
 * ou EventBus real está emitindo isso.
 */

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

export const mockEvents: DeviceEvent[] = [
  {
    type: "device.state-changed",
    deviceId: "dev.light-sala",
    occurredAt: minutesAgo(2),
    previousState: {
      status: "online",
      attributes: { power: "on", brightness: 40 },
      observedAt: minutesAgo(3),
    },
    currentState: {
      status: "online",
      attributes: { power: "on", brightness: 78 },
      observedAt: minutesAgo(2),
    },
  },
  {
    type: "device.action-executed",
    deviceId: "dev.thermostat-sala",
    occurredAt: minutesAgo(5),
    action: { type: "set_temperature", payload: { temperature: 22 } },
    result: { success: true },
  },
  {
    type: "device.error",
    deviceId: "dev.server-rack-a-01",
    occurredAt: minutesAgo(9),
    message: "CPU acima de 90% por mais de 5 minutos.",
  },
  {
    type: "device.disconnected",
    deviceId: "dev.camera-entrada",
    occurredAt: minutesAgo(45),
    reason: "timeout de conexão",
  },
  {
    type: "device.connected",
    deviceId: "dev.sensor-presenca-sala",
    occurredAt: minutesAgo(58),
  },
  {
    type: "device.disconnected",
    deviceId: "dev.impressora-escritorio",
    occurredAt: minutesAgo(180),
    reason: "desligada manualmente",
  },
];
