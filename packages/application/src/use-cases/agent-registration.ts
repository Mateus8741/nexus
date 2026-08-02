import { randomUUID } from "node:crypto";
import type {
  ActorContext,
  AgentRegistration,
  AgentRegistrationRepository,
  EventBus,
  PermissionService,
  SystemEvent,
} from "@nexus/domain";

export interface RegisterAgentInput {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly name?: string;
  readonly version?: string;
  readonly publicKey?: string;
  readonly providerHint?: string;
  readonly lastIp?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ApproveAgentInput {
  readonly actor: ActorContext;
  readonly agentId: string;
  readonly tokenHash: string;
}

export interface RevokeAgentInput {
  readonly actor: ActorContext;
  readonly agentId: string;
}

export interface RotateAgentTokenInput {
  readonly actor: ActorContext;
  readonly agentId: string;
  readonly newTokenHash: string;
  readonly gracePeriodMs?: number;
}

export class RegisterAgentUseCase {
  constructor(
    private readonly repository: AgentRegistrationRepository,
    private readonly eventBus: EventBus<SystemEvent>,
  ) {}

  async execute(input: RegisterAgentInput): Promise<AgentRegistration> {
    const existing = await this.repository.getByAgentId(input.agentId);
    if (existing) {
      if (existing.status === "revoked") {
        const renewed: AgentRegistration = {
          ...existing,
          status: "pending",
          tokenHash: undefined,
          name: input.name ?? existing.name,
          version: input.version ?? existing.version,
          publicKey: input.publicKey ?? existing.publicKey,
          providerHint: input.providerHint ?? existing.providerHint,
          lastIp: input.lastIp ?? existing.lastIp,
          metadata: input.metadata ?? existing.metadata,
          updatedAt: new Date(),
          revokedAt: undefined,
        };
        await this.repository.update(renewed);
        this.eventBus.publish({
          type: "agent.registration-requested",
          occurredAt: new Date(),
          workspaceId: renewed.workspaceId,
          agentId: renewed.agentId,
          name: renewed.name,
        });
        return renewed;
      }
      return existing;
    }

    const registration: AgentRegistration = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      status: "pending",
      name: input.name,
      version: input.version,
      publicKey: input.publicKey,
      providerHint: input.providerHint,
      lastIp: input.lastIp,
      metadata: input.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.repository.create(registration);
    this.eventBus.publish({
      type: "agent.registration-requested",
      occurredAt: new Date(),
      workspaceId: registration.workspaceId,
      agentId: registration.agentId,
      name: registration.name,
    });
    return registration;
  }
}

export class ApproveAgentUseCase {
  constructor(
    private readonly repository: AgentRegistrationRepository,
    private readonly permissionService: PermissionService,
    private readonly eventBus: EventBus<SystemEvent>,
  ) {}

  async execute(input: ApproveAgentInput): Promise<AgentRegistration> {
    await this.permissionService.require(input.actor, "agent.approve");
    const existing = await this.repository.getByAgentId(input.agentId);
    if (!existing) throw new Error(`Agent "${input.agentId}" não encontrado.`);
    if (existing.status === "approved") return existing;

    const updated: AgentRegistration = {
      ...existing,
      status: "approved",
      tokenHash: input.tokenHash,
      previousTokenHash: undefined,
      previousTokenExpiresAt: undefined,
      updatedAt: new Date(),
      approvedAt: new Date(),
      revokedAt: undefined,
    };
    await this.repository.update(updated);
    this.eventBus.publish({
      type: "agent.approved",
      occurredAt: new Date(),
      workspaceId: updated.workspaceId,
      agentId: updated.agentId,
      approvedByUserId: input.actor.id,
    });
    return updated;
  }
}

export class RevokeAgentUseCase {
  constructor(
    private readonly repository: AgentRegistrationRepository,
    private readonly permissionService: PermissionService,
    private readonly eventBus: EventBus<SystemEvent>,
  ) {}

  async execute(input: RevokeAgentInput): Promise<AgentRegistration> {
    await this.permissionService.require(input.actor, "agent.revoke");
    const existing = await this.repository.getByAgentId(input.agentId);
    if (!existing) throw new Error(`Agent "${input.agentId}" não encontrado.`);

    const updated: AgentRegistration = {
      ...existing,
      status: "revoked",
      tokenHash: undefined,
      previousTokenHash: undefined,
      previousTokenExpiresAt: undefined,
      updatedAt: new Date(),
      revokedAt: new Date(),
    };
    await this.repository.update(updated);
    this.eventBus.publish({
      type: "agent.revoked",
      occurredAt: new Date(),
      workspaceId: updated.workspaceId,
      agentId: updated.agentId,
      revokedByUserId: input.actor.id,
    });
    return updated;
  }
}

export class RotateAgentTokenUseCase {
  constructor(
    private readonly repository: AgentRegistrationRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: RotateAgentTokenInput): Promise<AgentRegistration> {
    await this.permissionService.require(input.actor, "agent.approve");
    const existing = await this.repository.getByAgentId(input.agentId);
    if (!existing) throw new Error(`Agent "${input.agentId}" não encontrado.`);
    if (existing.status !== "approved") {
      throw new Error("Só é possível rotacionar token de agents aprovados.");
    }

    const gracePeriodMs = input.gracePeriodMs ?? 24 * 60 * 60 * 1000;
    const updated: AgentRegistration = {
      ...existing,
      previousTokenHash: existing.tokenHash,
      previousTokenExpiresAt: new Date(Date.now() + gracePeriodMs),
      tokenHash: input.newTokenHash,
      updatedAt: new Date(),
    };
    await this.repository.update(updated);
    return updated;
  }
}

export class MarkAgentConnectedUseCase {
  constructor(
    private readonly repository: AgentRegistrationRepository,
    private readonly eventBus: EventBus<SystemEvent>,
  ) {}

  async execute(input: {
    readonly agentId: string;
    readonly ip?: string;
    readonly version?: string;
  }): Promise<AgentRegistration | undefined> {
    const existing = await this.repository.getByAgentId(input.agentId);
    if (existing?.status !== "approved") return existing;

    const updated: AgentRegistration = {
      ...existing,
      lastConnectedAt: new Date(),
      lastIp: input.ip ?? existing.lastIp,
      version: input.version ?? existing.version,
      updatedAt: new Date(),
    };
    await this.repository.update(updated);
    this.eventBus.publish({
      type: "agent.connected",
      occurredAt: new Date(),
      workspaceId: updated.workspaceId,
      agentId: updated.agentId,
      ip: updated.lastIp,
    });
    return updated;
  }
}
