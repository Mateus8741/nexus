import type { ActorType } from "../auth/actor";
import type { SystemEvent } from "../events/system-event";

export interface AuditEntry {
  readonly event: SystemEvent;
  readonly recordedAt: Date;
}

export interface PersistedAuditRecord {
  readonly id: number;
  readonly workspaceId?: string;
  readonly recordedAt: Date;
  readonly action: string;
  readonly actorType: ActorType | string;
  readonly actorId?: string;
  readonly outcome: string;
  readonly metadata: Record<string, unknown>;
  readonly ip?: string;
}

/**
 * AuditLog — histórico somente-leitura. Quem escreve é sempre a
 * implementação concreta assinando o EventBus — nenhum módulo grava
 * audit_logs diretamente.
 */
export interface AuditLog {
  list(limit?: number): readonly AuditEntry[];
  listPersisted?(options?: {
    readonly limit?: number;
    readonly workspaceId?: string;
  }): Promise<readonly PersistedAuditRecord[]>;
}
