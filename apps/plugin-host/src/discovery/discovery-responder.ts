import dgram from "node:dgram";
import os from "node:os";

import {
  AGENT_PROTOCOL_VERSION,
  DISCOVERY_DEFAULT_PORT,
  type DiscoveryResponseMessage,
  isDiscoveryRequestMessage,
} from "@nexus/agent-protocol";

export interface DiscoveryResponderOptions {
  readonly port: number;
  readonly discoveryPort?: number;
}

/**
 * Responde, via UDP broadcast, à pergunta "onde está o Core?" feita por um
 * Agent na rede local (ver @nexus/agent-protocol/discovery). Existe para
 * que ninguém precise descobrir manualmente o IP da máquina que roda o
 * plugin-host — o Agent broadcasta a pergunta, o Core responde de volta
 * (unicast) com as portas de WebSocket/HTTP, e o Agent usa o IP de origem
 * do pacote de resposta (garantido correto pelo próprio SO/kernel, não
 * informado por nós) para montar a URL de conexão.
 *
 * Não conhece nada sobre Windows/plugins — só sabe responder "estou aqui,
 * minhas portas são X e Y". Mesma postura de "sem autenticação" do resto
 * do protocolo nesta etapa (ver ARCHITECTURE.md).
 */
export class DiscoveryResponder {
  private readonly socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  private readonly port: number;

  constructor(private readonly options: DiscoveryResponderOptions) {
    this.port = options.discoveryPort ?? DISCOVERY_DEFAULT_PORT;
  }

  start(): void {
    this.socket.on("message", (data, rinfo) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!isDiscoveryRequestMessage(parsed)) return;

      const response: DiscoveryResponseMessage = {
        type: "nexus-here",
        protocolVersion: AGENT_PROTOCOL_VERSION,
        hostname: os.hostname(),
        port: this.options.port,
      };
      this.socket.send(JSON.stringify(response), rinfo.port, rinfo.address);
    });

    // Bind em 0.0.0.0 (todas as interfaces) — não importa se o Agent
    // perguntar via Wi-Fi ou Ethernet, respondemos igual.
    this.socket.bind(this.port);
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.socket.close(() => resolve()));
  }
}
