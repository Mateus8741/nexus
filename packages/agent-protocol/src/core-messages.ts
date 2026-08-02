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

export type CoreMessage = CoreActionCommandMessage;

export type CoreMessageType = CoreMessage["type"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCoreMessage(value: unknown): value is CoreMessage {
  if (!isRecord(value)) return false;
  if (value.type !== "action-command") return false;
  if (typeof value.requestId !== "string" || value.requestId.length === 0) return false;
  return isAgentActionType(value.action);
}
