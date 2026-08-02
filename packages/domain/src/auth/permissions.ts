/**
 * Chaves de permissão atômicas. Novas actions de plugins devem
 * registrar `action.<type>` correspondente no seed/migrations.
 */
export const PERMISSION_KEYS = [
  "device.read",
  "device.write",
  "action.shutdown",
  "action.restart",
  "action.lock",
  "action.executeCommand",
  "plugin.install",
  "plugin.remove",
  "workspace.manage",
  "user.manage",
  "agent.approve",
  "agent.revoke",
  "agent.read",
  "apikey.manage",
  "audit.read",
  "event.read",
  "settings.manage",
  "session.manage",
  "role.read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number] | `action.${string}`;

export const SYSTEM_ROLE_KEYS = ["owner", "admin", "operator", "viewer"] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const ROLE_PERMISSION_MAP: Readonly<Record<SystemRoleKey, readonly PermissionKey[]>> = {
  owner: PERMISSION_KEYS,
  admin: PERMISSION_KEYS.filter((key) => key !== "workspace.manage"),
  operator: [
    "device.read",
    "device.write",
    "action.shutdown",
    "action.restart",
    "action.lock",
    "action.executeCommand",
    "agent.read",
    "audit.read",
    "event.read",
    "role.read",
  ],
  viewer: ["device.read", "agent.read", "audit.read", "event.read", "role.read"],
};
