import { randomUUID } from "node:crypto";
import type { ActorContext, PermissionService, Space, SpaceRepository } from "@nexus/domain";

export interface CreateSpaceInput {
  readonly actor: ActorContext;
  readonly name: string;
  readonly parentId?: string;
}

/**
 * Cria um novo Space (ambiente) dentro do workspace do actor — ex.: "Casa da
 * Mariana". Gerencial: exige `workspace.manage`, mesma permissão de outras
 * telas de administração (Roles, Users).
 */
export class CreateSpaceUseCase {
  constructor(
    private readonly spaces: SpaceRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: CreateSpaceInput): Promise<Space> {
    await this.permissionService.require(input.actor, "workspace.manage");
    const space: Space = {
      id: randomUUID(),
      workspaceId: input.actor.workspaceId,
      name: input.name,
      parentId: input.parentId,
      createdAt: new Date(),
    };
    await this.spaces.create(space);
    return space;
  }
}

export class ListSpacesUseCase {
  constructor(
    private readonly spaces: SpaceRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: { readonly actor: ActorContext }): Promise<readonly Space[]> {
    await this.permissionService.require(input.actor, "workspace.manage");
    return this.spaces.listByWorkspace(input.actor.workspaceId);
  }
}
