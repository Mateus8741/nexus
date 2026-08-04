export interface Membership {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly roleId: string;
  /**
   * `undefined` = sem restrição de ambiente (enxerga todo o workspace — é o
   * caso do Owner hoje). Preenchido = membro só enxerga dispositivos desse
   * Space (ver ActorContext.spaceId, e o filtro em
   * apps/plugin-host/src/http/server.ts).
   */
  readonly spaceId?: string;
  readonly createdAt: Date;
}
