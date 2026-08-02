export interface PersistedEvent {
  readonly id?: number;
  readonly workspaceId?: string;
  readonly occurredAt: Date;
  readonly type: string;
  readonly source: string;
  readonly actorType?: string;
  readonly actorUserId?: string;
  readonly deviceId?: string;
  readonly payload: Record<string, unknown>;
}

export interface EventStore {
  append(event: PersistedEvent): Promise<void>;
  list(options?: {
    readonly limit?: number;
    readonly workspaceId?: string;
    readonly typePrefix?: string;
  }): Promise<readonly PersistedEvent[]>;
}
