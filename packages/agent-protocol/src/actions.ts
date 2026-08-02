/**
 * Ações que um Agent pode executar quando o Core manda um `action-command`.
 * Deliberadamente uma lista fechada e pequena nesta etapa — screenshot,
 * explorer, terminal remoto, transferência de arquivos, clipboard,
 * processos, serviços, Wake On LAN, Remote Desktop e instalação de
 * softwares ficam para depois (ver ARCHITECTURE.md).
 */
export const AGENT_ACTION_TYPES = ["shutdown", "restart", "lock", "executeCommand"] as const;

export type AgentActionType = (typeof AGENT_ACTION_TYPES)[number];

export function isAgentActionType(value: unknown): value is AgentActionType {
  return typeof value === "string" && (AGENT_ACTION_TYPES as readonly string[]).includes(value);
}

/** Payload por ação. Só `executeCommand` precisa de dado adicional. */
export interface AgentActionPayload {
  readonly command?: string;
}
