/**
 * @nexus/agent-protocol — o "idioma" comum entre o Core (via um
 * DeviceProvider baseado em Agent, ex.: @nexus/plugin-windows) e um Agent
 * remoto (ex.: apps/agent-windows).
 *
 * Zero dependências, de propósito: este pacote é o único que um Agent
 * remoto precisa conhecer sobre o Nexus. Um Agent NÃO depende de
 * @nexus/domain, @nexus/plugins-sdk, @nexus/application ou
 * @nexus/infrastructure — só deste protocolo. Isso é o que permite, no
 * futuro, reescrever um agent em outra linguagem (Go, Rust, C#) sem tocar
 * em nada do resto do monorepo: basta implementar o mesmo formato de
 * mensagens JSON descrito aqui.
 *
 * Reaproveitável tal e qual por qualquer plugin no "padrão Agent" (Windows
 * hoje; Linux/macOS amanhã) — Docker e Home Assistant, que falam
 * diretamente com uma API/daemon já existente, não precisam deste pacote.
 */

export type { AgentActionPayload, AgentActionType } from "./actions";
export { AGENT_ACTION_TYPES, isAgentActionType } from "./actions";

export type {
  AgentActionResultMessage,
  AgentHeartbeatMessage,
  AgentMessage,
  AgentMessageType,
  AgentMetricsMessage,
  AgentRegisterMessage,
} from "./agent-messages";
export { isAgentMessage } from "./agent-messages";

export type { CoreActionCommandMessage, CoreMessage, CoreMessageType } from "./core-messages";
export { isCoreMessage } from "./core-messages";

export type { DiscoveryRequestMessage, DiscoveryResponseMessage } from "./discovery";
export {
  DISCOVERY_DEFAULT_PORT,
  isDiscoveryRequestMessage,
  isDiscoveryResponseMessage,
} from "./discovery";

export type { AgentMetricsSnapshot, AgentSystemInfo } from "./metrics";

export { AGENT_PROTOCOL_VERSION } from "./version";
