import { randomUUID } from "node:crypto";
import type { ActorContext, Membership, MembershipRepository, PermissionService } from "@nexus/domain";

export interface CreateMembershipInput {
  readonly actor: ActorContext;
  readonly userId: string;
  readonly roleId: string;
  /**
   * Ambiente ao qual o novo membro fica restrito. `undefined` = sem
   * restrição (enxerga o workspace inteiro) — ver Membership.spaceId.
   */
  readonly spaceId?: string;
}

/**
 * Vincula um usuário (já criado via Better Auth — ver handleInviteUser em
 * apps/plugin-host/src/http/server.ts, que chama auth.api.signUpEmail antes
 * disto) a um workspace com um papel e, opcionalmente, um Space. Não cria o
 * usuário em si: @nexus/application não pode depender do Better Auth.
 */
export class CreateMembershipUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: CreateMembershipInput): Promise<Membership> {
    await this.permissionService.require(input.actor, "user.manage");
    const membership: Membership = {
      id: randomUUID(),
      workspaceId: input.actor.workspaceId,
      userId: input.userId,
      roleId: input.roleId,
      spaceId: input.spaceId,
      createdAt: new Date(),
    };
    await this.memberships.create(membership);
    return membership;
  }
}
