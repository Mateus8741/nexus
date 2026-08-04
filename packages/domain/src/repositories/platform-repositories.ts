import type { Membership } from "../entities/membership";
import type { ProviderAccount } from "../entities/provider-account";
import type { Role } from "../entities/role";
import type { Space } from "../entities/space";
import type { User } from "../entities/user";
import type { Workspace } from "../entities/workspace";

export interface WorkspaceRepository {
  create(workspace: Workspace): Promise<void>;
  get(id: string): Promise<Workspace | undefined>;
  getBySlug(slug: string): Promise<Workspace | undefined>;
  list(): Promise<readonly Workspace[]>;
}

export interface SpaceRepository {
  create(space: Space): Promise<void>;
  listByWorkspace(workspaceId: string): Promise<readonly Space[]>;
  get(id: string): Promise<Space | undefined>;
}

export interface MembershipRepository {
  create(membership: Membership): Promise<void>;
  getByUserAndWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<(Membership & { roleKey: string }) | undefined>;
  listByWorkspace(
    workspaceId: string,
  ): Promise<readonly (Membership & { roleKey: string; user: User })[]>;
  listByUser(userId: string): Promise<readonly (Membership & { roleKey: string })[]>;
}

export interface RoleRepository {
  listByWorkspace(workspaceId: string): Promise<readonly Role[]>;
  getByKey(workspaceId: string, key: string): Promise<Role | undefined>;
  listPermissions(roleId: string): Promise<readonly string[]>;
}

export interface SettingsRepository {
  get(workspaceId: string, key: string): Promise<unknown | undefined>;
  set(workspaceId: string, key: string, value: unknown): Promise<void>;
  list(workspaceId: string): Promise<readonly { key: string; value: unknown }[]>;
}

export interface NotificationHistoryRepository {
  append(entry: {
    readonly id: string;
    readonly workspaceId?: string;
    readonly channel: string;
    readonly title: string;
    readonly body: string;
    readonly payload: Record<string, unknown>;
    readonly status: string;
    readonly createdAt: Date;
  }): Promise<void>;
  list(options?: { readonly workspaceId?: string; readonly limit?: number }): Promise<
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
  >;
}

export interface PluginRepository {
  upsert(plugin: {
    readonly id: string;
    readonly workspaceId: string;
    readonly pluginKey: string;
    readonly version: string;
    readonly status: string;
    readonly config: Record<string, unknown>;
  }): Promise<void>;
  list(workspaceId: string): Promise<
    readonly {
      readonly id: string;
      readonly pluginKey: string;
      readonly version: string;
      readonly status: string;
      readonly config: Record<string, unknown>;
    }[]
  >;
  remove(workspaceId: string, pluginKey: string): Promise<void>;
}

/**
 * Contas externas (ex.: contas Tuya/Smart Life) vinculadas a um Space —
 * ver ProviderAccount para o racional completo de por que isso é genérico
 * por provider e não específico da Tuya.
 */
export interface ProviderAccountRepository {
  create(account: ProviderAccount): Promise<void>;
  listByProvider(providerId: string): Promise<readonly ProviderAccount[]>;
  listByWorkspace(workspaceId: string): Promise<readonly ProviderAccount[]>;
}

export interface CapabilityDefinitionRepository {
  upsert(capability: {
    readonly key: string;
    readonly definition: Record<string, unknown>;
    readonly ownerPluginKey?: string;
  }): Promise<void>;
  list(): Promise<
    readonly {
      readonly key: string;
      readonly definition: Record<string, unknown>;
      readonly ownerPluginKey?: string;
    }[]
  >;
}
