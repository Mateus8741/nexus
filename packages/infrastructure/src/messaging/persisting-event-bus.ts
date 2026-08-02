import type { EventBus, EventStore, SystemEvent } from "@nexus/domain";

function extractDeviceId(event: SystemEvent): string | undefined {
  return "deviceId" in event ? event.deviceId : undefined;
}

function extractActor(event: SystemEvent): {
  actorType?: string;
  actorUserId?: string;
} {
  switch (event.type) {
    case "auth.login":
    case "auth.logout":
      return { actorType: "user", actorUserId: event.userId };
    case "auth.failure":
      return { actorType: "anonymous" };
    case "agent.approved":
      return { actorType: "user", actorUserId: event.approvedByUserId };
    case "agent.revoked":
      return { actorType: "user", actorUserId: event.revokedByUserId };
    case "permission.denied":
      return { actorType: event.actorType, actorUserId: event.actorId };
    case "agent.connected":
    case "agent.registration-requested":
      return { actorType: "agent", actorUserId: event.agentId };
    default:
      return {};
  }
}

function toPayload(event: SystemEvent): Record<string, unknown> {
  const {
    occurredAt: _occurredAt,
    type: _type,
    workspaceId: _workspaceId,
    ...rest
  } = event as SystemEvent & {
    occurredAt: Date;
    type: string;
    workspaceId?: string;
  };
  return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>;
}

/**
 * Decorator: persiste todo evento antes do fan-out in-memory.
 * publish continua sync na interface; a persistência é enfileirada e
 * erros viram internal.error no bus interno (após publish já feito no
 * caso de falha de write, logamos via console no composition root).
 */
export class PersistingEventBus implements EventBus<SystemEvent> {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly inner: EventBus<SystemEvent>,
    private readonly eventStore: EventStore,
    private readonly defaultWorkspaceId?: string,
  ) {}

  publish(event: SystemEvent): void {
    const workspaceId =
      ("workspaceId" in event ? event.workspaceId : undefined) ?? this.defaultWorkspaceId;
    const actor = extractActor(event);

    this.writeChain = this.writeChain
      .then(() =>
        this.eventStore.append({
          workspaceId,
          occurredAt: event.occurredAt,
          type: event.type,
          source: inferSource(event),
          actorType: actor.actorType,
          actorUserId: actor.actorUserId,
          deviceId: extractDeviceId(event),
          payload: toPayload(event),
        }),
      )
      .catch((error: unknown) => {
        console.error("[PersistingEventBus] falha ao persistir evento:", error);
      });

    this.inner.publish(event);
  }

  subscribe(listener: (event: SystemEvent) => void): () => void {
    return this.inner.subscribe(listener);
  }

  /** Aguarda a fila de writes (útil em shutdown/tests). */
  async flush(): Promise<void> {
    await this.writeChain;
  }
}

function inferSource(event: SystemEvent): string {
  if (event.type.startsWith("device.")) return "device";
  if (event.type.startsWith("plugin.")) return "plugin";
  if (event.type.startsWith("auth.")) return "auth";
  if (event.type.startsWith("agent.")) return "agent";
  if (event.type.startsWith("permission.")) return "rbac";
  if (event.type.startsWith("capability.")) return "capability";
  if (event.type.startsWith("internal.")) return "system";
  return "system";
}
