import type { Device } from "../entities/device";
import type { DeviceEvent } from "../events/device-event";
import type { DeviceState } from "../value-objects/device-state";

/**
 * DeviceRegistry — contrato de quem rastreia, em memória, todos os
 * dispositivos conhecidos pelo Nexus (agregando um ou mais DeviceProvider).
 *
 * Implementação concreta: InMemoryDeviceRegistry, em @nexus/infrastructure
 * (agregar múltiplos DeviceProvider é uma decisão de infraestrutura, não de
 * domínio — só a abstração vive aqui).
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

  /**
   * Publica um DeviceEvent para quem estiver assinado via subscribe().
   *
   * Não é chamado internamente por register/unregister/updateState (que só
   * mutam o estado conhecido) — o registry não tem como reconstituir, por
   * exemplo, o resultado de uma ação ou o motivo de uma desconexão. Quem
   * está sincronizando este registry com um DeviceProvider (ver
   * @nexus/application/AttachDeviceProviderUseCase) é responsável por
   * chamar isto logo após aplicar a mutação correspondente, repassando o
   * mesmo DeviceEvent recebido do provider — preservando a informação
   * original, sem o registry precisar "adivinhar" nada.
   */
  notify(event: DeviceEvent): void;
}
