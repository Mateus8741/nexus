import type { NexusDatabase } from "@nexus/db";
import { memberships, rolePermissions, roles } from "@nexus/db";
import type {
  ActorContext,
  EventBus,
  PermissionKey,
  PermissionService,
  ResourceRef,
  SystemEvent,
} from "@nexus/domain";
import { PermissionDeniedError } from "@nexus/domain";
import { and, eq } from "drizzle-orm";

/**
 * Implementação central de RBAC. Owner short-circuit; demais roles via
 * memberships → role_permissions. Sempre emite permission.denied no bus.
 */
export class PostgresPermissionService implements PermissionService {
  constructor(
    private readonly db: NexusDatabase,
    private readonly eventBus: EventBus<SystemEvent>,
  ) {}

  async check(
    actor: ActorContext,
    permission: PermissionKey,
    resource?: ResourceRef,
  ): Promise<boolean> {
    if (resource?.workspaceId && resource.workspaceId !== actor.workspaceId) {
      return false;
    }

    if (actor.type === "system") return true;

    if (actor.roleKey === "owner") return true;

    if (actor.permissions?.includes(permission)) return true;
    if (actor.permissions?.includes("*")) return true;

    if (actor.type === "api_key") {
      return actor.permissions?.includes(permission) ?? false;
    }

    if (actor.type !== "user") return false;

    const membership = await this.db
      .select({
        roleKey: roles.key,
        permissionKey: rolePermissions.permissionKey,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(and(eq(memberships.userId, actor.id), eq(memberships.workspaceId, actor.workspaceId)));

    if (membership.length === 0) return false;
    if (membership.some((row) => row.roleKey === "owner")) return true;
    return membership.some((row) => row.permissionKey === permission);
  }

  async require(
    actor: ActorContext,
    permission: PermissionKey,
    resource?: ResourceRef,
  ): Promise<void> {
    const allowed = await this.check(actor, permission, resource);
    if (allowed) return;

    this.eventBus.publish({
      type: "permission.denied",
      occurredAt: new Date(),
      workspaceId: actor.workspaceId,
      actorId: actor.id,
      actorType: actor.type,
      permission,
      resource: resource?.deviceId ?? resource?.agentId,
    });

    throw new PermissionDeniedError(actor, permission);
  }
}
