export interface ApiKey {
  readonly id: string;
  readonly workspaceId: string;
  readonly createdByUserId?: string;
  readonly name: string;
  readonly keyHash: string;
  readonly prefix: string;
  readonly scopes: readonly string[];
  readonly expiresAt?: Date;
  readonly lastUsedAt?: Date;
  readonly revokedAt?: Date;
  readonly createdAt: Date;
}
