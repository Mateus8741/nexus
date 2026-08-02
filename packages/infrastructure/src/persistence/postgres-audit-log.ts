import type { NexusDatabase } from "@nexus/db";
import { auditLogs } from "@nexus/db";
import type {
  AuditEntry,
  AuditLog,
  EventBus,
  PersistedAuditRecord,
  SystemEvent,
} from "@nexus/domain";
import { desc, eq } from "drizzle-orm";

interface MappedAudit {
  readonly action: string;
  readonly actorType: string;
  readonly actorId?: string;
  readonly outcome: string;
  readonly metadata: Record<string, unknown>;
  readonly ip?: string;
  readonly workspaceId?: string;
}

function mapEvent(event: SystemEvent): MappedAudit | null {
  switch (event.type) {
    case "auth.login":
      return {
        action: "Login",
        actorType: "user",
        actorId: event.userId,
        outcome: "success",
        metadata: {},
        ip: event.ip,
        workspaceId: event.workspaceId,
      };
    case "auth.logout":
      return {
        action: "Logout",
        actorType: "user",
        actorId: event.userId,
        outcome: "success",
        metadata: {},
        ip: event.ip,
        workspaceId: event.workspaceId,
      };
    case "auth.failure":
      return {
        action: "AuthFailure",
        actorType: "anonymous",
        outcome: "failure",
        metadata: { email: event.email, reason: event.reason },
        ip: event.ip,
        workspaceId: event.workspaceId,
      };
    case "agent.connected":
      return {
        action: "AgentConnected",
        actorType: "agent",
        actorId: event.agentId,
        outcome: "success",
        metadata: {},
        ip: event.ip,
        workspaceId: event.workspaceId,
      };
    case "agent.approved":
      return {
        action: "AgentApproved",
        actorType: "user",
        actorId: event.approvedByUserId,
        outcome: "success",
        metadata: { agentId: event.agentId },
        workspaceId: event.workspaceId,
      };
    case "agent.revoked":
      return {
        action: "AgentRevoked",
        actorType: "user",
        actorId: event.revokedByUserId,
        outcome: "success",
        metadata: { agentId: event.agentId },
        workspaceId: event.workspaceId,
      };
    case "device.action-executed":
      return {
        action: "ActionExecuted",
        actorType: "system",
        outcome: event.result.success ? "success" : "failure",
        metadata: {
          deviceId: event.deviceId,
          actionType: event.action.type,
          error: event.result.error,
        },
        workspaceId: event.workspaceId,
      };
    case "permission.denied":
      return {
        action: "PermissionDenied",
        actorType: event.actorType,
        actorId: event.actorId,
        outcome: "denied",
        metadata: { permission: event.permission, resource: event.resource },
        workspaceId: event.workspaceId,
      };
    case "plugin.loaded":
      return {
        action: "PluginLoaded",
        actorType: "system",
        outcome: "success",
        metadata: { pluginId: event.pluginId },
        workspaceId: event.workspaceId,
      };
    case "plugin.unloaded":
      return {
        action: "PluginRemoved",
        actorType: "system",
        outcome: "success",
        metadata: { pluginId: event.pluginId },
        workspaceId: event.workspaceId,
      };
    case "internal.error":
      return {
        action: "InternalError",
        actorType: "system",
        outcome: "failure",
        metadata: { message: event.message, source: event.source },
        workspaceId: event.workspaceId,
      };
    default:
      return null;
  }
}

/**
 * Único escritor de audit_logs. Assina o EventBus — nenhum outro módulo
 * deve inserir nesta tabela.
 */
export class PostgresAuditLog implements AuditLog {
  private readonly recent: AuditEntry[] = [];
  private readonly maxRecent: number;

  constructor(
    private readonly db: NexusDatabase,
    eventBus: EventBus<SystemEvent>,
    options?: { readonly maxRecent?: number },
  ) {
    this.maxRecent = options?.maxRecent ?? 200;
    eventBus.subscribe((event) => {
      this.recent.push({ event, recordedAt: new Date() });
      if (this.recent.length > this.maxRecent) this.recent.shift();
      const mapped = mapEvent(event);
      if (!mapped) return;
      void this.db
        .insert(auditLogs)
        .values({
          workspaceId: mapped.workspaceId,
          recordedAt: event.occurredAt,
          action: mapped.action,
          actorType: mapped.actorType,
          actorId: mapped.actorId,
          outcome: mapped.outcome,
          metadata: mapped.metadata,
          ip: mapped.ip,
        })
        .catch((error: unknown) => {
          console.error("[PostgresAuditLog] falha ao gravar audit:", error);
        });
    });
  }

  list(limit = 50): readonly AuditEntry[] {
    return this.recent.slice(-limit).reverse();
  }

  async listPersisted(options?: {
    readonly limit?: number;
    readonly workspaceId?: string;
  }): Promise<readonly PersistedAuditRecord[]> {
    const limit = options?.limit ?? 50;
    let query = this.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.recordedAt))
      .limit(limit)
      .$dynamic();

    if (options?.workspaceId) {
      query = query.where(eq(auditLogs.workspaceId, options.workspaceId));
    }

    const rows = await query;
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId ?? undefined,
      recordedAt: row.recordedAt,
      action: row.action,
      actorType: row.actorType,
      actorId: row.actorId ?? undefined,
      outcome: row.outcome,
      metadata: row.metadata,
      ip: row.ip ?? undefined,
    }));
  }
}
