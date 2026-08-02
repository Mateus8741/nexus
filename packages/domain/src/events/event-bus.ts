/**
 * EventBus — barramento de eventos genérico. Não sabe o que é `TEvent`: só
 * publica e distribui para quem assinou. A instância real do Core é
 * tipada como `EventBus<SystemEvent>` (ver ./system-event.ts), mas a
 * interface em si não assume isso — pode ser reaproveitada para qualquer
 * fluxo interno de eventos.
 *
 * Toda comunicação interna do sistema deve passar por uma instância disto
 * (ver PROJECT.md/ARCHITECTURE.md, "consolidação do Core") — inclusive
 * eventos de dispositivo, que hoje o DeviceRegistry expõe via seu próprio
 * notify()/subscribe(): a implementação concreta (InMemoryDeviceRegistry,
 * em @nexus/infrastructure) delega para um EventBus injetado em vez de
 * manter uma lista de ouvintes própria — não é um canal paralelo.
 *
 * Implementação concreta: InMemoryEventBus, em @nexus/infrastructure.
 */
export interface EventBus<TEvent> {
  publish(event: TEvent): void;
  /** Retorna uma função para cancelar a assinatura. */
  subscribe(listener: (event: TEvent) => void): () => void;
}
