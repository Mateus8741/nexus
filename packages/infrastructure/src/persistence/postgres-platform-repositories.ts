import type { NexusDatabase } from "@nexus/db";
import {
  capabilities,
  memberships,
  notificationHistory,
  plugins,
  providerAccounts,
  rolePermissions,
  roles,
  settings,
  spaces,
  user,
  workspaces,
} from "@nexus/db";
import type {
  CapabilityDefinitionRepository,
  Membership,
  MembershipRepository,
  NotificationHistoryRepository,
  PluginRepository,
  ProviderAccount,
  ProviderAccountRepository,
  Role,
  RoleRepository,
  SettingsRepository,
  Space,
  SpaceRepository,
  User,
  Workspace,
  WorkspaceRepository,
} from "@nexus/domain";
import { and, desc, eq } from "drizzle-orm";

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: NexusDatabase) {}

  async create(workspace: Workspace): Promise<void> {
    await this.db.insert(workspaces).values({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdAt: workspace.createdAt,
    });
  }

  async get(id: string): Promise<Workspace | undefined> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return { id: row.id, name: row.name, slug: row.slug, createdAt: row.createdAt };
  }

  async getBySlug(slug: string): Promise<Workspace | undefined> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return { id: row.id, name: row.name, slug: row.slug, createdAt: row.createdAt };
  }

  async list(): Promise<readonly Workspace[]> {
    const rows = await this.db.select().from(workspaces);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt,
    }));
  }
}

export class PostgresSpaceRepository implements SpaceRepository {
  constructor(private readonly db: NexusDatabase) {}

  async create(space: Space): Promise<void> {
    await this.db.insert(spaces).values({
      id: space.id,
      workspaceId: space.workspaceId,
      name: space.name,
      parentId: space.parentId,
      createdAt: space.createdAt,
    });
  }

  async listByWorkspace(workspaceId: string): Promise<readonly Space[]> {
    const rows = await this.db.select().from(spaces).where(eq(spaces.workspaceId, workspaceId));
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      parentId: row.parentId ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async get(id: string): Promise<Space | undefined> {
    const rows = await this.db.select().from(spaces).where(eq(spaces.id, id)).limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      parentId: row.parentId ?? undefined,
      createdAt: row.createdAt,
    };
  }
}

export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private readonly db: NexusDatabase) {}

  async create(membership: Membership): Promise<void> {
    await this.db.insert(memberships).values({
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      roleId: membership.roleId,
      spaceId: membership.spaceId,
      createdAt: membership.createdAt,
    });
  }

  async getByUserAndWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<(Membership & { roleKey: string }) | undefined> {
    const rows = await this.db
      .select({
        id: memberships.id,
        workspaceId: memberships.workspaceId,
        userId: memberships.userId,
        roleId: memberships.roleId,
        spaceId: memberships.spaceId,
        createdAt: memberships.createdAt,
        roleKey: roles.key,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return { ...row, spaceId: row.spaceId ?? undefined };
  }

  async listByWorkspace(
    workspaceId: string,
  ): Promise<readonly (Membership & { roleKey: string; user: User })[]> {
    const rows = await this.db
      .select({
        id: memberships.id,
        workspaceId: memberships.workspaceId,
        userId: memberships.userId,
        roleId: memberships.roleId,
        spaceId: memberships.spaceId,
        createdAt: memberships.createdAt,
        roleKey: roles.key,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image,
        userCreatedAt: user.createdAt,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .innerJoin(user, eq(memberships.userId, user.id))
      .where(eq(memberships.workspaceId, workspaceId));

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      roleId: row.roleId,
      spaceId: row.spaceId ?? undefined,
      createdAt: row.createdAt,
      roleKey: row.roleKey,
      user: {
        id: row.userId,
        email: row.email,
        name: row.name,
        emailVerified: row.emailVerified,
        image: row.image ?? undefined,
        createdAt: row.userCreatedAt,
      },
    }));
  }

  async listByUser(userId: string): Promise<readonly (Membership & { roleKey: string })[]> {
    const rows = await this.db
      .select({
        id: memberships.id,
        workspaceId: memberships.workspaceId,
        userId: memberships.userId,
        roleId: memberships.roleId,
        spaceId: memberships.spaceId,
        createdAt: memberships.createdAt,
        roleKey: roles.key,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.userId, userId));
    return rows.map((row) => ({ ...row, spaceId: row.spaceId ?? undefined }));
  }
}

export class PostgresProviderAccountRepository implements ProviderAccountRepository {
  constructor(private readonly db: NexusDatabase) {}

  async create(account: ProviderAccount): Promise<void> {
    await this.db.insert(providerAccounts).values({
      id: account.id,
      workspaceId: account.workspaceId,
      spaceId: account.spaceId,
      providerId: account.providerId,
      externalId: account.externalId,
      label: account.label,
      createdAt: account.createdAt,
    });
  }

  async listByProvider(providerId: string): Promise<readonly ProviderAccount[]> {
    const rows = await this.db
      .select()
      .from(providerAccounts)
      .where(eq(providerAccounts.providerId, providerId));
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      spaceId: row.spaceId,
      providerId: row.providerId,
      externalId: row.externalId,
      label: row.label ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async listByWorkspace(workspaceId: string): Promise<readonly ProviderAccount[]> {
    const rows = await this.db
      .select()
      .from(providerAccounts)
      .where(eq(providerAccounts.workspaceId, workspaceId));
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      spaceId: row.spaceId,
      providerId: row.providerId,
      externalId: row.externalId,
      label: row.label ?? undefined,
      createdAt: row.createdAt,
    }));
  }
}

export class PostgresRoleRepository implements RoleRepository {
  constructor(private readonly db: NexusDatabase) {}

  async listByWorkspace(workspaceId: string): Promise<readonly Role[]> {
    const rows = await this.db.select().from(roles).where(eq(roles.workspaceId, workspaceId));
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      key: row.key,
      name: row.name,
      system: row.system,
    }));
  }

  async getByKey(workspaceId: string, key: string): Promise<Role | undefined> {
    const rows = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.workspaceId, workspaceId), eq(roles.key, key)))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      key: row.key,
      name: row.name,
      system: row.system,
    };
  }

  async listPermissions(roleId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((row) => row.permissionKey);
  }
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly db: NexusDatabase) {}

  async get(workspaceId: string, key: string): Promise<unknown | undefined> {
    const rows = await this.db
      .select()
      .from(settings)
      .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, key)))
      .limit(1);
    return rows[0]?.value;
  }

  async set(workspaceId: string, key: string, value: unknown): Promise<void> {
    await this.db
      .insert(settings)
      .values({ workspaceId, key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [settings.workspaceId, settings.key],
        set: { value, updatedAt: new Date() },
      });
  }

  async list(workspaceId: string): Promise<readonly { key: string; value: unknown }[]> {
    const rows = await this.db.select().from(settings).where(eq(settings.workspaceId, workspaceId));
    return rows.map((row) => ({ key: row.key, value: row.value }));
  }
}

export class PostgresNotificationHistoryRepository implements NotificationHistoryRepository {
  constructor(private readonly db: NexusDatabase) {}

  async append(entry: {
    readonly id: string;
    readonly workspaceId?: string;
    readonly channel: string;
    readonly title: string;
    readonly body: string;
    readonly payload: Record<string, unknown>;
    readonly status: string;
    readonly createdAt: Date;
  }): Promise<void> {
    await this.db.insert(notificationHistory).values({
      id: entry.id,
      workspaceId: entry.workspaceId,
      channel: entry.channel,
      title: entry.title,
      body: entry.body,
      payload: entry.payload,
      status: entry.status,
      createdAt: entry.createdAt,
    });
  }

  async list(options?: { readonly workspaceId?: string; readonly limit?: number }): Promise<
    readonly {
      readonly id: string;
      readonly workspaceId?: string;
      readonly channel: string;
      readonly title: string;
      readonly body: string;
      readonly payload: Record<string, unknown>;
      readonly status: string;
      readonly createdAt: Date;
    }[]
  > {
    const limit = options?.limit ?? 50;
    let query = this.db
      .select()
      .from(notificationHistory)
      .orderBy(desc(notificationHistory.createdAt))
      .limit(limit)
      .$dynamic();
    if (options?.workspaceId) {
      query = query.where(eq(notificationHistory.workspaceId, options.workspaceId));
    }
    const rows = await query;
    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId ?? undefined,
      channel: row.channel,
      title: row.title,
      body: row.body,
      payload: row.payload,
      status: row.status,
      createdAt: row.createdAt,
    }));
  }
}

export class PostgresPluginRepository implements PluginRepository {
  constructor(private readonly db: NexusDatabase) {}

  async upsert(plugin: {
    readonly id: string;
    readonly workspaceId: string;
    readonly pluginKey: string;
    readonly version: string;
    readonly status: string;
    readonly config: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .insert(plugins)
      .values({
        id: plugin.id,
        workspaceId: plugin.workspaceId,
        pluginKey: plugin.pluginKey,
        version: plugin.version,
        status: plugin.status,
        config: plugin.config,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [plugins.workspaceId, plugins.pluginKey],
        set: {
          version: plugin.version,
          status: plugin.status,
          config: plugin.config,
          updatedAt: new Date(),
        },
      });
  }

  async list(workspaceId: string) {
    return this.db.select().from(plugins).where(eq(plugins.workspaceId, workspaceId));
  }

  async remove(workspaceId: string, pluginKey: string): Promise<void> {
    await this.db
      .delete(plugins)
      .where(and(eq(plugins.workspaceId, workspaceId), eq(plugins.pluginKey, pluginKey)));
  }
}

export class PostgresCapabilityDefinitionRepository implements CapabilityDefinitionRepository {
  constructor(private readonly db: NexusDatabase) {}

  async upsert(capability: {
    readonly key: string;
    readonly definition: Record<string, unknown>;
    readonly ownerPluginKey?: string;
  }): Promise<void> {
    await this.db
      .insert(capabilities)
      .values({
        key: capability.key,
        definition: capability.definition,
        ownerPluginKey: capability.ownerPluginKey,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: capabilities.key,
        set: {
          definition: capability.definition,
          ownerPluginKey: capability.ownerPluginKey,
          updatedAt: new Date(),
        },
      });
  }

  async list() {
    const rows = await this.db.select().from(capabilities);
    return rows.map((row) => ({
      key: row.key,
      definition: row.definition,
      ownerPluginKey: row.ownerPluginKey ?? undefined,
    }));
  }
}
