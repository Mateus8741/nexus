import type { Device } from "../entities/device";
import type { DeviceEvent } from "../events/device-event";
import type { DeviceState } from "../value-objects/device-state";

/**
 * DeviceRegistry — contrato de quem rastreia, em memória, todos os
 * dispositivos conhecidos pelo Nexus (agregando um ou mais DeviceProvider).
 *
 * Só a interface existe aqui, de propósito: ao contrário de
 * @nexus/plugins-sdk/PluginRegistry (uma classe concreta), este prompt pede
 * "apenas as interfaces" — a implementação (provavelmente baseada em Map,
 * como o PluginRegistry) fica para um próximo passo, provavelmente em
 * @nexus/infrastructure, já que agregar múltiplos DeviceProvider é uma
 * decisão de infraestrutura, não de domínio.
 */
export interface DeviceRegistry {
  register(device: Device): void;
  unregister(deviceId: string): void;

  get(deviceId: string): Device | undefined;
  has(deviceId: string): boolean;
  list(): readonly Device[];

  listByProvider(providerId: string): readonly Device[];
  listByKind(kind: string): readonly Device[];

  /** Substitui o estado de um dispositivo já registrado (ex.: após um DeviceStateChangedEvent). */
  updateState(deviceId: string, state: DeviceState): void;

  /** Assina os eventos de todos os dispositivos rastreados por este registry. Retorna uma função para cancelar a assinatura. */
  subscribe(listener: (event: DeviceEvent) => void): () => void;
}
