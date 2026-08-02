import type {
  ActorContext,
  AgentRegistrationRepository,
  ApiKeyRepository,
  AuditLog,
  EventStore,
  MembershipRepository,
  PermissionService,
  RoleRepository,
} from "@nexus/domain";

export class ListAuditLogsUseCase {
  constructor(
    private readonly auditLog: AuditLog,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: { readonly actor: ActorContext; readonly limit?: number }) {
    await this.permissionService.require(input.actor, "audit.read");
    if (this.auditLog.listPersisted) {
      return this.auditLog.listPersisted({
        limit: input.limit,
        workspaceId: input.actor.workspaceId,
      });
    }
    return this.auditLog.list(input.limit);
  }
}

export class ListPersistedEventsUseCase {
  constructor(
    private readonly eventStore: EventStore,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: {
    readonly actor: ActorContext;
    readonly limit?: number;
    readonly typePrefix?: string;
  }) {
    await this.permissionService.require(input.actor, "event.read");
    return this.eventStore.list({
      limit: input.limit,
      workspaceId: input.actor.workspaceId,
      typePrefix: input.typePrefix,
    });
  }
}

export class ListUsersUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: { readonly actor: ActorContext }) {
    await this.permissionService.require(input.actor, "user.manage");
    return this.memberships.listByWorkspace(input.actor.workspaceId);
  }
}

export class ListRolesUseCase {
  constructor(
    private readonly roles: RoleRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: { readonly actor: ActorContext }) {
    await this.permissionService.require(input.actor, "role.read");
    const list = await this.roles.listByWorkspace(input.actor.workspaceId);
    return Promise.all(
      list.map(async (role) => ({
        ...role,
        permissions: await this.roles.listPermissions(role.id),
      })),
    );
  }
}

export class ListAgentsUseCase {
  constructor(
    private readonly agents: AgentRegistrationRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: {
    readonly actor: ActorContext;
    readonly status?: "pending" | "approved" | "revoked";
  }) {
    await this.permissionService.require(input.actor, "agent.read");
    return this.agents.list({
      workspaceId: input.actor.workspaceId,
      status: input.status,
    });
  }
}

export class ListApiKeysUseCase {
  constructor(
    private readonly apiKeys: ApiKeyRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: { readonly actor: ActorContext }) {
    await this.permissionService.require(input.actor, "apikey.manage");
    return this.apiKeys.list(input.actor.workspaceId);
  }
}
