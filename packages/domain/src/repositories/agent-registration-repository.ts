import type { AgentRegistration, AgentRegistrationStatus } from "../entities/agent-registration";

export interface AgentRegistrationRepository {
  create(registration: AgentRegistration): Promise<void>;
  update(registration: AgentRegistration): Promise<void>;
  getByAgentId(agentId: string): Promise<AgentRegistration | undefined>;
  list(options?: {
    readonly workspaceId?: string;
    readonly status?: AgentRegistrationStatus;
  }): Promise<readonly AgentRegistration[]>;
  findByTokenHash(tokenHash: string): Promise<AgentRegistration | undefined>;
}
