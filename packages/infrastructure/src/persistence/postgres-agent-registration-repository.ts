import type { NexusDatabase } from "@nexus/db";
import { agentRegistrations } from "@nexus/db";
import type {
  AgentRegistration,
  AgentRegistrationRepository,
  AgentRegistrationStatus,
} from "@nexus/domain";
import { and, eq, or } from "drizzle-orm";

function rowToRegistration(row: typeof agentRegistrations.$inferSelect): AgentRegistration {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    status: row.status as AgentRegistrationStatus,
    tokenHash: row.tokenHash ?? undefined,
    previousTokenHash: row.previousTokenHash ?? undefined,
    previousTokenExpiresAt: row.previousTokenExpiresAt ?? undefined,
    publicKey: row.publicKey ?? undefined,
    lastIp: row.lastIp ?? undefined,
    version: row.version ?? undefined,
    lastConnectedAt: row.lastConnectedAt ?? undefined,
    providerHint: row.providerHint ?? undefined,
    name: row.name ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    approvedAt: row.approvedAt ?? undefined,
    revokedAt: row.revokedAt ?? undefined,
  };
}

export class PostgresAgentRegistrationRepository implements AgentRegistrationRepository {
  constructor(private readonly db: NexusDatabase) {}

  async create(registration: AgentRegistration): Promise<void> {
    await this.db.insert(agentRegistrations).values({
      id: registration.id,
      workspaceId: registration.workspaceId,
      agentId: registration.agentId,
      status: registration.status,
      tokenHash: registration.tokenHash,
      previousTokenHash: registration.previousTokenHash,
      previousTokenExpiresAt: registration.previousTokenExpiresAt,
      publicKey: registration.publicKey,
      lastIp: registration.lastIp,
      version: registration.version,
      lastConnectedAt: registration.lastConnectedAt,
      providerHint: registration.providerHint,
      name: registration.name,
      metadata: registration.metadata,
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt,
      approvedAt: registration.approvedAt,
      revokedAt: registration.revokedAt,
    });
  }

  async update(registration: AgentRegistration): Promise<void> {
    await this.db
      .update(agentRegistrations)
      .set({
        status: registration.status,
        tokenHash: registration.tokenHash,
        previousTokenHash: registration.previousTokenHash,
        previousTokenExpiresAt: registration.previousTokenExpiresAt,
        publicKey: registration.publicKey,
        lastIp: registration.lastIp,
        version: registration.version,
        lastConnectedAt: registration.lastConnectedAt,
        providerHint: registration.providerHint,
        name: registration.name,
        metadata: registration.metadata,
        updatedAt: registration.updatedAt,
        approvedAt: registration.approvedAt,
        revokedAt: registration.revokedAt,
      })
      .where(eq(agentRegistrations.agentId, registration.agentId));
  }

  async getByAgentId(agentId: string): Promise<AgentRegistration | undefined> {
    const rows = await this.db
      .select()
      .from(agentRegistrations)
      .where(eq(agentRegistrations.agentId, agentId))
      .limit(1);
    const row = rows[0];
    return row ? rowToRegistration(row) : undefined;
  }

  async list(options?: {
    readonly workspaceId?: string;
    readonly status?: AgentRegistrationStatus;
  }): Promise<readonly AgentRegistration[]> {
    const conditions = [];
    if (options?.workspaceId) {
      conditions.push(eq(agentRegistrations.workspaceId, options.workspaceId));
    }
    if (options?.status) {
      conditions.push(eq(agentRegistrations.status, options.status));
    }

    const rows =
      conditions.length > 0
        ? await this.db
            .select()
            .from(agentRegistrations)
            .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : await this.db.select().from(agentRegistrations);

    return rows.map(rowToRegistration);
  }

  async findByTokenHash(tokenHash: string): Promise<AgentRegistration | undefined> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(agentRegistrations)
      .where(
        or(
          eq(agentRegistrations.tokenHash, tokenHash),
          and(
            eq(agentRegistrations.previousTokenHash, tokenHash),
            // previous token still in grace — checked in app layer too
          ),
        ),
      )
      .limit(5);

    for (const row of rows) {
      if (row.tokenHash === tokenHash) return rowToRegistration(row);
      if (
        row.previousTokenHash === tokenHash &&
        row.previousTokenExpiresAt &&
        row.previousTokenExpiresAt > now
      ) {
        return rowToRegistration(row);
      }
    }
    return undefined;
  }
}
