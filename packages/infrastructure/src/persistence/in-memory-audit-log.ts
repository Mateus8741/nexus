import type { AuditEntry, AuditLog, EventBus, SystemEvent } from "@nexus/domain";

const DEFAULT_CAPACITY = 500;

/**
 * Implementação concreta, em memória, de AuditLog (@nexus/domain). Assina
 * o EventBus inteiro (todo SystemEvent, não só eventos de dispositivo) e
 * mantém um buffer circular — substitui o `EventLog` que antes vivia só
 * dentro de apps/plugin-host e só via eventos de dispositivo (ver
 * ARCHITECTURE.md, "Audit Log").
 *
 * Nenhum plugin ou use-case escreve aqui diretamente — só esta classe,
 * assinando o bus sozinha, grava (ver "Nenhum plugin deve salvar logs
 * diretamente" no domínio).
 */
export class InMemoryAuditLog implements AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly capacity: number;

  constructor(eventBus: EventBus<SystemEvent>, capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    eventBus.subscribe((event) => this.record(event));
  }

  list(limit?: number): readonly AuditEntry[] {
    return limit === undefined ? [...this.entries] : this.entries.slice(0, limit);
  }

  private record(event: SystemEvent): void {
    this.entries.unshift({ event, recordedAt: new Date() });
    if (this.entries.length > this.capacity) {
      this.entries.length = this.capacity;
    }
  }
}
