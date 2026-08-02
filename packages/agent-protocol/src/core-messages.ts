import type { AgentActionPayload, AgentActionType } from "./actions";
import { isAgentActionType } from "./actions";

/**
 * Comando enviado do Core para um Agent já conectado. `requestId` é gerado
 * pelo Core e devolvido pelo Agent em `AgentActionResultMessage` para
 * correlacionar pergunta/resposta assíncrona sobre o mesmo socket.
 */
export interface CoreActionCommandMessage {
  readonly type: "action-command";
  readonly requestId: string;
  readonly action: AgentActionType;
  readonly payload?: AgentActionPayload;
}

export interface CoreRegistrationPendingMessage {
  readonly type: "registration-pending";
  readonly agentId: string;
}

export interface CoreRegistrationApprovedMessage {
  readonly type: "registration-approved";
  readonly agentId: string;
  readonly token: string;
}

export interface CoreRegistrationRejectedMessage {
  readonly type: "registration-rejected";
  readonly agentId: string;
  readonly reason: string;
}

export type CoreMessage =
  | CoreActionCommandMessage
  | CoreRegistrationPendingMessage
  | CoreRegistrationApprovedMessage
  | CoreRegistrationRejectedMessage;

export type CoreMessageType = CoreMessage["type"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCoreMessage(value: unknown): value is CoreMessage {
  if (!isRecord(value)) return false;

  switch (value.type) {
    case "action-command":
      return (
        typeof value.requestId === "string" &&
        value.requestId.length > 0 &&
        isAgentActionType(value.action)
      );
    case "registration-pending":
      return typeof value.agentId === "string";
    case "registration-approved":
      return typeof value.agentId === "string" && typeof value.token === "string";
    case "registration-rejected":
      return typeof value.agentId === "string" && typeof value.reason === "string";
    default:
      return false;
  }
}
