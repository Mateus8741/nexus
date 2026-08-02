export type AgentRegistrationStatus = "pending" | "approved" | "revoked";

export interface AgentRegistration {
  readonly id: string;
  readonly workspaceId: string;
  readonly agentId: string;
  readonly status: AgentRegistrationStatus;
  readonly tokenHash?: string;
  readonly previousTokenHash?: string;
  readonly previousTokenExpiresAt?: Date;
  readonly publicKey?: string;
  readonly lastIp?: string;
  readonly version?: string;
  readonly lastConnectedAt?: Date;
  readonly providerHint?: string;
  readonly name?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly approvedAt?: Date;
  readonly revokedAt?: Date;
}
