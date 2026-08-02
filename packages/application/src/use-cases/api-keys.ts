import { randomUUID } from "node:crypto";
import type { ActorContext, ApiKey, ApiKeyRepository, PermissionService } from "@nexus/domain";

export interface CreateApiKeyInput {
  readonly actor: ActorContext;
  readonly name: string;
  readonly keyHash: string;
  readonly prefix: string;
  readonly scopes: readonly string[];
  readonly expiresAt?: Date;
}

export interface RevokeApiKeyInput {
  readonly actor: ActorContext;
  readonly apiKeyId: string;
}

export class CreateApiKeyUseCase {
  constructor(
    private readonly repository: ApiKeyRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: CreateApiKeyInput): Promise<ApiKey> {
    await this.permissionService.require(input.actor, "apikey.manage");
    const apiKey: ApiKey = {
      id: randomUUID(),
      workspaceId: input.actor.workspaceId,
      createdByUserId: input.actor.type === "user" ? input.actor.id : undefined,
      name: input.name,
      keyHash: input.keyHash,
      prefix: input.prefix,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };
    await this.repository.create(apiKey);
    return apiKey;
  }
}

export class RevokeApiKeyUseCase {
  constructor(
    private readonly repository: ApiKeyRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: RevokeApiKeyInput): Promise<void> {
    await this.permissionService.require(input.actor, "apikey.manage");
    await this.repository.revoke(input.apiKeyId, new Date());
  }
}
