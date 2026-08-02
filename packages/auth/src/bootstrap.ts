import type { NexusDatabase } from "@nexus/db";
import {
  memberships,
  permissions,
  rolePermissions,
  roles,
  spaces,
  user,
  workspaces,
} from "@nexus/db";
import { PERMISSION_KEYS, ROLE_PERMISSION_MAP, SYSTEM_ROLE_KEYS } from "@nexus/domain";
import { eq, sql } from "drizzle-orm";

export interface BootstrapOwnerInput {
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly userId: string;
  readonly workspaceName?: string;
  readonly workspaceSlug?: string;
}

/**
 * Seeds permissões globais (idempotente) e, no bootstrap, cria workspace
 * default + roles de sistema + membership Owner para o primeiro usuário.
 */
export async function seedPermissions(db: NexusDatabase): Promise<void> {
  const descriptions: Record<string, string> = {
    "device.read": "Listar e visualizar dispositivos",
    "device.write": "Alterar dispositivos e executar ações",
    "action.shutdown": "Desligar dispositivo",
    "action.restart": "Reiniciar dispositivo",
    "action.lock": "Bloquear dispositivo",
    "action.executeCommand": "Executar comando remoto",
    "plugin.install": "Instalar plugins",
    "plugin.remove": "Remover plugins",
    "workspace.manage": "Gerenciar workspace",
    "user.manage": "Gerenciar usuários",
    "agent.approve": "Aprovar agents",
    "agent.revoke": "Revogar agents",
    "agent.read": "Listar agents",
    "apikey.manage": "Gerenciar API keys",
    "audit.read": "Ler audit logs",
    "event.read": "Ler eventos",
    "settings.manage": "Gerenciar settings",
    "session.manage": "Gerenciar sessões",
    "role.read": "Ler papéis e permissões",
  };

  for (const key of PERMISSION_KEYS) {
    await db
      .insert(permissions)
      .values({ key, description: descriptions[key] ?? key })
      .onConflictDoNothing();
  }
}

export async function countUsers(db: NexusDatabase): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  return result[0]?.count ?? 0;
}

export async function ensureWorkspaceRoles(
  db: NexusDatabase,
  workspaceId: string,
): Promise<Record<string, string>> {
  const roleIds: Record<string, string> = {};

  for (const key of SYSTEM_ROLE_KEYS) {
    const existing = await db.select().from(roles).where(eq(roles.workspaceId, workspaceId));
    const found = existing.find((row) => row.key === key);
    if (found) {
      roleIds[key] = found.id;
      continue;
    }

    const id = crypto.randomUUID();
    await db.insert(roles).values({
      id,
      workspaceId,
      key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      system: true,
    });
    roleIds[key] = id;

    const perms = ROLE_PERMISSION_MAP[key];
    for (const permissionKey of perms) {
      await db.insert(rolePermissions).values({ roleId: id, permissionKey }).onConflictDoNothing();
    }
  }

  return roleIds;
}

export async function bootstrapOwner(
  db: NexusDatabase,
  input: BootstrapOwnerInput,
): Promise<{ workspaceId: string; userId: string }> {
  await seedPermissions(db);

  const workspaceId = crypto.randomUUID();
  const slug = input.workspaceSlug ?? "default";
  const name = input.workspaceName ?? "Default Workspace";

  await db.insert(workspaces).values({
    id: workspaceId,
    name,
    slug,
  });

  const roleIds = await ensureWorkspaceRoles(db, workspaceId);

  await db.insert(spaces).values({
    id: crypto.randomUUID(),
    workspaceId,
    name: "Default",
  });

  // User row is created by Better Auth sign-up; this path inserts when
  // bootstrap uses direct insert + account password via Better Auth API.
  // Callers should prefer auth.api.signUpEmail then attach membership.

  const ownerRoleId = roleIds.owner;
  if (!ownerRoleId) {
    throw new Error("Owner role missing after seed");
  }

  await db.insert(memberships).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId: input.userId,
    roleId: ownerRoleId,
  });

  return { workspaceId, userId: input.userId };
}

export async function ensureDefaultWorkspace(
  db: NexusDatabase,
  workspaceName = "Default Workspace",
  workspaceSlug = "default",
): Promise<{ workspaceId: string }> {
  await seedPermissions(db);

  const existingWorkspaces = await db.select().from(workspaces).limit(1);
  if (existingWorkspaces[0]) {
    await ensureWorkspaceRoles(db, existingWorkspaces[0].id);
    return { workspaceId: existingWorkspaces[0].id };
  }

  const workspaceId = crypto.randomUUID();
  await db.insert(workspaces).values({
    id: workspaceId,
    name: workspaceName,
    slug: workspaceSlug,
  });
  await db.insert(spaces).values({
    id: crypto.randomUUID(),
    workspaceId,
    name: "Default",
  });
  await ensureWorkspaceRoles(db, workspaceId);
  return { workspaceId };
}

export async function attachOwnerMembership(
  db: NexusDatabase,
  userId: string,
  workspaceName = "Default Workspace",
  workspaceSlug = "default",
): Promise<{ workspaceId: string }> {
  const { workspaceId } = await ensureDefaultWorkspace(db, workspaceName, workspaceSlug);

  const roleIds = await ensureWorkspaceRoles(db, workspaceId);
  const ownerRoleId = roleIds.owner;
  if (!ownerRoleId) {
    throw new Error("Owner role missing after seed");
  }

  await db.insert(memberships).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId,
    roleId: ownerRoleId,
  });

  return { workspaceId };
}
