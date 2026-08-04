import { randomUUID } from "node:crypto";
import type {
  ActorContext,
  PermissionService,
  ProviderAccount,
  ProviderAccountRepository,
} from "@nexus/domain";

export interface CreateProviderAccountInput {
  readonly actor: ActorContext;
  readonly spaceId: string;
  readonly providerId: string;
  readonly externalId: string;
  readonly label?: string;
}

/**
 * Registra uma conta externa (ex.: uid de uma conta Tuya/Smart Life)
 * vinculada a um Space. Não sabe nada sobre Tuya especificamente — ver
 * ProviderAccount para o racional. Quem consome isto no bootstrap do
 * plugin-host é o próprio provider (ex.: createTuyaPlugin recebe a lista de
 * contas filtrada por `providerId: "nexus.tuya"`).
 */
export class CreateProviderAccountUseCase {
  constructor(
    private readonly providerAccounts: ProviderAccountRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: CreateProviderAccountInput): Promise<ProviderAccount> {
    await this.permissionService.require(input.actor, "workspace.manage");
    const account: ProviderAccount = {
      id: randomUUID(),
      workspaceId: input.actor.workspaceId,
      spaceId: input.spaceId,
      providerId: input.providerId,
      externalId: input.externalId,
      label: input.label,
      createdAt: new Date(),
    };
    await this.providerAccounts.create(account);
    return account;
  }
}

export class ListProviderAccountsUseCase {
  constructor(
    private readonly providerAccounts: ProviderAccountRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async execute(input: { readonly actor: ActorContext }): Promise<readonly ProviderAccount[]> {
    await this.permissionService.require(input.actor, "workspace.manage");
    return this.providerAccounts.listByWorkspace(input.actor.workspaceId);
  }
}
