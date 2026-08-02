/**
 * Protocolo de descoberta automática do Core na rede local, via UDP
 * broadcast — existe para que um Agent (ex.: apps/agent-windows) não
 * precise que um humano descubra e digite manualmente o IP da máquina que
 * roda o Core (apps/plugin-host).
 *
 * Fluxo: o Agent manda um `DiscoveryRequestMessage` em broadcast
 * (255.255.255.255) na porta abaixo; qualquer Core ouvindo nessa porta
 * responde, em unicast de volta para quem perguntou, com um
 * `DiscoveryResponseMessage` contendo as portas de WebSocket/HTTP. O Agent
 * usa o IP de origem do pacote de resposta (não algo dentro do payload)
 * como IP do Core — isso é o que resolve corretamente o caso de a máquina
 * do Core ter múltiplas interfaces de rede (Wi-Fi, Ethernet, VPN...).
 *
 * Deliberadamente sem autenticação nesta etapa (mesma postura do restante
 * do protocolo hoje) — assume rede local confiável. Ver ARCHITECTURE.md.
 */

/** Porta UDP usada para descoberta — não é a mesma do WebSocket nem da HTTP API. */
export const DISCOVERY_DEFAULT_PORT = 41234;

export interface DiscoveryRequestMessage {
  readonly type: "nexus-discover";
  readonly protocolVersion: string;
}

export interface DiscoveryResponseMessage {
  readonly type: "nexus-here";
  readonly protocolVersion: string;
  readonly hostname: string;
  /** Porta única onde o Core serve HTTP e WebSocket (mesmo processo/servidor — ver ARCHITECTURE.md). */
  readonly port: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isDiscoveryRequestMessage(value: unknown): value is DiscoveryRequestMessage {
  if (!isRecord(value)) return false;
  return value.type === "nexus-discover" && typeof value.protocolVersion === "string";
}

export function isDiscoveryResponseMessage(value: unknown): value is DiscoveryResponseMessage {
  if (!isRecord(value)) return false;
  if (value.type !== "nexus-here") return false;
  if (typeof value.protocolVersion !== "string") return false;
  if (typeof value.hostname !== "string") return false;
  if (typeof value.port !== "number") return false;
  return true;
}
