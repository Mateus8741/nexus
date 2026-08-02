import type { DeviceEvent, DeviceRegistry } from "@nexus/domain";

/**
 * EventLog — buffer circular em memória dos DeviceEvent mais recentes.
 *
 * Independente de HTTP de propósito: só assina o DeviceRegistry e guarda um
 * histórico curto para a rota GET /events poder responder algo além do
 * estado atual (o registry não guarda histórico, só o snapshot vivo de cada
 * Device). Perdido ao reiniciar apps/plugin-host, assim como o próprio
 * InMemoryDeviceRegistry — não há pretensão de persistência aqui.
 */
export class EventLog {
  private readonly events: DeviceEvent[] = [];

  constructor(
    deviceRegistry: DeviceRegistry,
    private readonly maxSize = 200,
  ) {
    deviceRegistry.subscribe((event) => {
      // unshift: mais recente primeiro, já na ordem em que list() deve
      // devolver — evita reordenar em toda leitura.
      this.events.unshift(event);
      this.events.length = Math.min(this.events.length, this.maxSize);
    });
  }

  /** Mais recentes primeiro. Sem `limit`, devolve o buffer inteiro (até maxSize). */
  list(limit?: number): DeviceEvent[] {
    return limit === undefined ? [...this.events] : this.events.slice(0, limit);
  }
}
