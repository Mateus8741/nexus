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
  /**
   * `undefined` = sem restrição de ambiente, o ator enxerga o workspace
   * inteiro (caso do Owner hoje). Preenchido = ator só pode enxergar/agir em
   * dispositivos cujo `device.spaceId` seja igual a este valor — ver
   * ExecuteDeviceActionUseCase e o filtro de listagem em
   * apps/plugin-host/src/http/server.ts. Espelha `Membership.spaceId`;
   * populado em resolveActor() a partir da membership do usuário logado.
   */
  readonly spaceId?: string;
}

export interface ResourceRef {
  readonly workspaceId?: string;
  readonly deviceId?: string;
  readonly agentId?: string;
}
