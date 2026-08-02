import type { AgentMetricsSnapshot, AgentSystemInfo } from "./metrics";

interface AgentMessageBase {
  readonly agentId: string;
}

/**
 * Primeira mensagem que um Agent envia ao conectar. `agentId` deve ser
 * estável entre reconexões (o Agent persiste esse valor localmente) — é o
 * que permite ao Core reconhecer "esse é o mesmo dispositivo de antes" em
 * vez de criar um Device novo a cada reconexão.
 */
export interface AgentRegisterMessage extends AgentMessageBase {
  readonly type: "register";
  readonly protocolVersion: string;
  readonly kind: "windows";
  readonly name: string;
  readonly system: AgentSystemInfo;
}

/** Sinal de vida periódico. Não carrega métricas — só prova que o processo está de pé. */
export interface AgentHeartbeatMessage extends AgentMessageBase {
  readonly type: "heartbeat";
  readonly sentAt: string;
}

export interface AgentMetricsMessage extends AgentMessageBase {
  readonly type: "metrics";
  readonly collectedAt: string;
  readonly metrics: AgentMetricsSnapshot;
}

/** Resposta a um `action-command`, correlacionada pelo mesmo `requestId`. */
export interface AgentActionResultMessage extends AgentMessageBase {
  readonly type: "action-result";
  readonly requestId: string;
  readonly success: boolean;
  readonly error?: string;
  /** Saída textual (ex.: stdout/stderr de `executeCommand`), quando houver. */
  readonly output?: string;
}

export type AgentMessage =
  | AgentRegisterMessage
  | AgentHeartbeatMessage
  | AgentMetricsMessage
  | AgentActionResultMessage;

export type AgentMessageType = AgentMessage["type"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Type guard em runtime — validação de forma mínima, não profunda. A
 * mensagem vem de um processo externo (o Agent), então isso é a fronteira
 * de confiança real, igual a isPluginManifest em @nexus/plugins-sdk.
 */
export function isAgentMessage(value: unknown): value is AgentMessage {
  if (!isRecord(value)) return false;
  if (typeof value.agentId !== "string" || value.agentId.length === 0) return false;

  switch (value.type) {
    case "register":
      return (
        typeof value.protocolVersion === "string" &&
        value.kind === "windows" &&
        typeof value.name === "string" &&
        isRecord(value.system)
      );
    case "heartbeat":
      return typeof value.sentAt === "string";
    case "metrics":
      return typeof value.collectedAt === "string" && isRecord(value.metrics);
    case "action-result":
      return typeof value.requestId === "string" && typeof value.success === "boolean";
    default:
      return false;
  }
}
