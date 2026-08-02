import { isAgentMessage } from "@nexus/agent-protocol";
import type { MarkAgentConnectedUseCase, RegisterAgentUseCase } from "@nexus/application";
import type { AgentRegistrationRepository, EventBus, SystemEvent } from "@nexus/domain";
import { hashToken } from "@nexus/infrastructure";
import type { AgentConnection, AgentGateway } from "@nexus/plugins-sdk";

/**
 * Ponte entre o AgentGateway bruto e o DeviceProvider.
 * Só encaminha conexões com Agent aprovado + token válido.
 * Mantém sockets pending para entregar o token na aprovação.
 */
export class AgentPairingBridge implements AgentGateway {
  private readonly approvedListeners = new Set<(connection: AgentConnection) => void>();
  private readonly pendingByAgentId = new Map<string, AgentConnection>();
  private readonly liveByAgentId = new Map<string, AgentConnection>();

  constructor(
    rawGateway: AgentGateway,
    private readonly workspaceId: string,
    private readonly registerAgent: RegisterAgentUseCase,
    private readonly markConnected: MarkAgentConnectedUseCase,
    private readonly agents: AgentRegistrationRepository,
    private readonly eventBus: EventBus<SystemEvent>,
  ) {
    rawGateway.onConnection((connection) => {
      void this.handleRawConnection(connection);
    });
  }

  onConnection(listener: (connection: AgentConnection) => void): () => void {
    this.approvedListeners.add(listener);
    return () => this.approvedListeners.delete(listener);
  }

  /** Entrega token ao Agent waiting (se ainda conectado). */
  deliverApprovalToken(agentId: string, token: string): boolean {
    const pending = this.pendingByAgentId.get(agentId);
    if (!pending) return false;
    pending.send({
      type: "registration-approved",
      agentId,
      token,
    });
    this.pendingByAgentId.delete(agentId);
    return true;
  }

  disconnectAgent(agentId: string, code = 4001, reason = "revoked"): void {
    this.liveByAgentId.get(agentId)?.close(code, reason);
    this.liveByAgentId.delete(agentId);
    this.pendingByAgentId.get(agentId)?.close(code, reason);
    this.pendingByAgentId.delete(agentId);
  }

  private async handleRawConnection(connection: AgentConnection): Promise<void> {
    let settled = false;

    const unsubscribe = connection.onMessage((raw) => {
      if (settled) return;
      if (!isAgentMessage(raw) || raw.type !== "register") return;
      settled = true;
      unsubscribe();
      void this.settleRegistration(connection, raw);
    });

    connection.onClose(() => {
      for (const [agentId, conn] of this.pendingByAgentId) {
        if (conn.id === connection.id) this.pendingByAgentId.delete(agentId);
      }
      for (const [agentId, conn] of this.liveByAgentId) {
        if (conn.id === connection.id) this.liveByAgentId.delete(agentId);
      }
    });
  }

  private async settleRegistration(
    connection: AgentConnection,
    raw: {
      readonly agentId: string;
      readonly name: string;
      readonly protocolVersion: string;
      readonly kind: string;
      readonly token?: string;
      readonly publicKey?: string;
      readonly system?: { readonly hostname?: string };
    },
  ): Promise<void> {
    const existing = await this.agents.getByAgentId(raw.agentId);

    if (raw.token) {
      const tokenHash = hashToken(raw.token);
      const byToken = await this.agents.findByTokenHash(tokenHash);
      if (!byToken || byToken.agentId !== raw.agentId || byToken.status !== "approved") {
        this.eventBus.publish({
          type: "auth.failure",
          occurredAt: new Date(),
          reason: "invalid_agent_token",
          workspaceId: this.workspaceId,
        });
        connection.send({
          type: "registration-rejected",
          agentId: raw.agentId,
          reason: "invalid_token",
        });
        connection.close(4003, "invalid token");
        return;
      }

      await this.markConnected.execute({
        agentId: raw.agentId,
        version: raw.protocolVersion,
      });
      this.liveByAgentId.set(raw.agentId, connection);
      this.forwardApproved(connection, raw);
      return;
    }

    if (existing?.status === "approved") {
      connection.send({
        type: "registration-rejected",
        agentId: raw.agentId,
        reason: "token_required",
      });
      connection.close(4003, "token required");
      return;
    }

    await this.registerAgent.execute({
      workspaceId: this.workspaceId,
      agentId: raw.agentId,
      name: raw.name,
      version: raw.protocolVersion,
      publicKey: raw.publicKey,
      providerHint: raw.kind,
      metadata: { hostname: raw.system?.hostname },
    });

    this.pendingByAgentId.set(raw.agentId, connection);
    connection.send({
      type: "registration-pending",
      agentId: raw.agentId,
    });
  }

  private forwardApproved(connection: AgentConnection, registerMessage: unknown): void {
    let registerReplayed = false;
    const wrapped: AgentConnection = {
      id: connection.id,
      send: (message) => connection.send(message),
      close: (code, reason) => connection.close(code, reason),
      onMessage: (listener) => {
        if (!registerReplayed) {
          registerReplayed = true;
          queueMicrotask(() => listener(registerMessage));
        }
        return connection.onMessage(listener);
      },
      onClose: (listener) => connection.onClose(listener),
    };

    for (const listener of this.approvedListeners) {
      listener(wrapped);
    }
  }
}
