export type ActorType = "user" | "api_key" | "agent" | "system";

/**
 * Contexto do principal autenticado. Sempre workspace-scoped.
 * Use-cases recebem isto; PermissionService é o único lugar que interpreta.
 */
export interface ActorContext {
  readonly type: ActorType;
  readonly id: string;
  readonly workspaceId: string;
  readonly roleKey?: string;
  readonly permissions?: readonly string[];
  readonly ip?: string;
  readonly userAgent?: string;
}

export interface ResourceRef {
  readonly workspaceId?: string;
  readonly deviceId?: string;
  readonly agentId?: string;
}
