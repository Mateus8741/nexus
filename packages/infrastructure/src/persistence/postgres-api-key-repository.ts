import type { NexusDatabase } from "@nexus/db";
import { apiKeys } from "@nexus/db";
import type { ApiKey, ApiKeyRepository } from "@nexus/domain";
import { eq } from "drizzle-orm";

function rowToApiKey(row: typeof apiKeys.$inferSelect): ApiKey {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdByUserId: row.createdByUserId ?? undefined,
    name: row.name,
    keyHash: row.keyHash,
    prefix: row.prefix,
    scopes: row.scopes,
    expiresAt: row.expiresAt ?? undefined,
    lastUsedAt: row.lastUsedAt ?? undefined,
    revokedAt: row.revokedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

export class PostgresApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly db: NexusDatabase) {}

  async create(apiKey: ApiKey): Promise<void> {
    await this.db.insert(apiKeys).values({
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
      createdByUserId: apiKey.createdByUserId,
      name: apiKey.name,
      keyHash: apiKey.keyHash,
      prefix: apiKey.prefix,
      scopes: [...apiKey.scopes],
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    });
  }

  async getById(id: string): Promise<ApiKey | undefined> {
    const rows = await this.db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToApiKey(row) : undefined;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | undefined> {
    const rows = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
    const row = rows[0];
    return row ? rowToApiKey(row) : undefined;
  }

  async list(workspaceId: string): Promise<readonly ApiKey[]> {
    const rows = await this.db.select().from(apiKeys).where(eq(apiKeys.workspaceId, workspaceId));
    return rows.map(rowToApiKey);
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.db.update(apiKeys).set({ revokedAt }).where(eq(apiKeys.id, id));
  }

  async touchLastUsed(id: string, at: Date): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsedAt: at }).where(eq(apiKeys.id, id));
  }
}
