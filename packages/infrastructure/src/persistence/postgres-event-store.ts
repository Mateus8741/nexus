import type { NexusDatabase } from "@nexus/db";
import { events } from "@nexus/db";
import type { EventStore, PersistedEvent } from "@nexus/domain";
import { desc, eq, like } from "drizzle-orm";

export class PostgresEventStore implements EventStore {
  constructor(private readonly db: NexusDatabase) {}

  async append(event: PersistedEvent): Promise<void> {
    await this.db.insert(events).values({
      workspaceId: event.workspaceId,
      occurredAt: event.occurredAt,
      type: event.type,
      source: event.source,
      actorType: event.actorType,
      actorUserId: event.actorUserId,
      deviceId: event.deviceId,
      payload: event.payload,
    });
  }

  async list(options?: {
    readonly limit?: number;
    readonly workspaceId?: string;
    readonly typePrefix?: string;
  }): Promise<readonly PersistedEvent[]> {
    const limit = options?.limit ?? 50;
    let query = this.db
      .select()
      .from(events)
      .orderBy(desc(events.occurredAt))
      .limit(limit)
      .$dynamic();

    if (options?.workspaceId) {
      query = query.where(eq(events.workspaceId, options.workspaceId));
    }
    if (options?.typePrefix) {
      query = query.where(like(events.type, `${options.typePrefix}%`));
    }

    const rows = await query;
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId ?? undefined,
      occurredAt: row.occurredAt,
      type: row.type,
      source: row.source,
      actorType: row.actorType ?? undefined,
      actorUserId: row.actorUserId ?? undefined,
      deviceId: row.deviceId ?? undefined,
      payload: row.payload,
    }));
  }
}
