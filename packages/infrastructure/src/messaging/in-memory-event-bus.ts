import type { EventBus } from "@nexus/domain";

/**
 * Implementação concreta, em memória, de EventBus (@nexus/domain). Uma
 * única instância disto, no composition root (apps/plugin-host), é o
 * único barramento de eventos do processo — InMemoryDeviceRegistry delega
 * seu `notify`/`subscribe` para cá em vez de manter uma lista de ouvintes
 * própria (ver ARCHITECTURE.md, "Event Bus").
 *
 * Síncrono e sem persistência, de propósito: um assinante lento não deve
 * atrasar quem publicou, mas isso fica para uma iteração futura (fila,
 * backpressure) se algum dia for necessário — nesta etapa o volume de
 * eventos é baixo o suficiente para não justificar a complexidade.
 */
export class InMemoryEventBus<TEvent> implements EventBus<TEvent> {
  private readonly listeners = new Set<(event: TEvent) => void>();

  publish(event: TEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: (event: TEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
