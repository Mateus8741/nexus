/**
 * Conta externa (ex.: uma conta de app Smart Life/Tuya, um usuário de Home
 * Assistant, etc.) vinculada a um Space específico. Genérica de propósito —
 * nenhuma menção a "Tuya" aqui, mesma regra de sempre (ver PROJECT.md): quem
 * interpreta `externalId` é o DeviceProvider do `providerId` correspondente
 * (ex.: @nexus/plugin-tuya lê `externalId` como `uid` da Tuya Cloud API).
 * Isso é o que permite várias contas do mesmo provider — uma por
 * Space/ambiente — em vez de um único valor fixo em variável de ambiente.
 */
export interface ProviderAccount {
  readonly id: string;
  readonly workspaceId: string;
  readonly spaceId: string;
  readonly providerId: string;
  readonly externalId: string;
  readonly label?: string;
  readonly createdAt: Date;
}
