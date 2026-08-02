import type { SystemEvent } from "../events/system-event";

export interface AuditEntry {
  readonly event: SystemEvent;
  readonly recordedAt: Date;
}

/**
 * AuditLog — histórico somente-leitura de tudo que passou pelo EventBus
 * (ver events/event-bus.ts). Quem escreve é sempre a implementação
 * concreta (InMemoryAuditLog, em @nexus/infrastructure), assinando o
 * EventBus sozinha — nenhum plugin ou use-case grava direto aqui (ver
 * ARCHITECTURE.md, "Nenhum plugin deve salvar logs diretamente").
 */
export interface AuditLog {
  list(limit?: number): readonly AuditEntry[];
}
