/**
 * @nexus/auth — Better Auth + bootstrap de Owner/workspace/RBAC.
 * Autoridade de autenticação do Core (plugin-host).
 */

export {
  attachOwnerMembership,
  type BootstrapOwnerInput,
  bootstrapOwner,
  countUsers,
  ensureDefaultWorkspace,
  ensureWorkspaceRoles,
  seedPermissions,
} from "./bootstrap";
export { createNexusAuthClient, type NexusAuthClient } from "./client";
export { type CreateAuthOptions, createAuth, type NexusAuth } from "./create-auth";
