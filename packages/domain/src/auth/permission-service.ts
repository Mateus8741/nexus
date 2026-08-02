import type { ActorContext, ResourceRef } from "./actor";
import type { PermissionKey } from "./permissions";

export class PermissionDeniedError extends Error {
  readonly permission: PermissionKey;
  readonly actor: ActorContext;

  constructor(actor: ActorContext, permission: PermissionKey) {
    super(`Permissão negada: ${permission}`);
    this.name = "PermissionDeniedError";
    this.permission = permission;
    this.actor = actor;
  }
}

/**
 * Único ponto de verificação de autorização do Core.
 * Nenhum handler/use-case deve checar role strings diretamente.
 */
export interface PermissionService {
  check(actor: ActorContext, permission: PermissionKey, resource?: ResourceRef): Promise<boolean>;

  require(actor: ActorContext, permission: PermissionKey, resource?: ResourceRef): Promise<void>;
}
