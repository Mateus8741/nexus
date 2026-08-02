import type { ApiKey } from "../entities/api-key";

export interface ApiKeyRepository {
  create(apiKey: ApiKey): Promise<void>;
  getById(id: string): Promise<ApiKey | undefined>;
  findByKeyHash(keyHash: string): Promise<ApiKey | undefined>;
  list(workspaceId: string): Promise<readonly ApiKey[]>;
  revoke(id: string, revokedAt: Date): Promise<void>;
  touchLastUsed(id: string, at: Date): Promise<void>;
}
