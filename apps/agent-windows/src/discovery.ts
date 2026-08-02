import dgram from "node:dgram";

import {
  AGENT_PROTOCOL_VERSION,
  DISCOVERY_DEFAULT_PORT,
  type DiscoveryRequestMessage,
  isDiscoveryResponseMessage,
} from "@nexus/agent-protocol";

export interface DiscoveredCore {
  readonly host: string;
  readonly wsPort: number;
  readonly httpPort: number;
}

export interface DiscoverCoreOptions {
  readonly timeoutMs?: number;
  readonly discoveryPort?: number;
}

const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Pergunta em broadcast UDP "onde está o Core?" e resolve com o primeiro
 * que responder (ver @nexus/agent-protocol/discovery para o formato das
 * mensagens e apps/plugin-host/src/discovery/discovery-responder.ts para
 * quem responde). O IP usado é o de origem do pacote de resposta — nunca
 * algo digitado manualmente — então funciona independente de qual
 * interface de rede (Wi-Fi/Ethernet) o Core estiver usando.
 *
 * Resolve `undefined` se ninguém responder dentro do timeout (rede sem
 * Core rodando, firewall bloqueando UDP broadcast, ou máquinas em
 * sub-redes diferentes que o roteador não repassa broadcast entre si).
 */
export function discoverCore(
  options: DiscoverCoreOptions = {},
): Promise<DiscoveredCore | undefined> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const discoveryPort = options.discoveryPort ?? DISCOVERY_DEFAULT_PORT;

  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;

    const finish = (result: DiscoveredCore | undefined): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(result);
    };

    const timer = setTimeout(() => finish(undefined), timeoutMs);

    socket.on("error", () => finish(undefined));

    socket.on("message", (data, rinfo) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return; // pacote malformado na rede — ignorado, não derruba a busca
      }
      if (!isDiscoveryResponseMessage(parsed)) return;
      finish({ host: rinfo.address, wsPort: parsed.wsPort, httpPort: parsed.httpPort });
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      const request: DiscoveryRequestMessage = {
        type: "nexus-discover",
        protocolVersion: AGENT_PROTOCOL_VERSION,
      };
      socket.send(JSON.stringify(request), discoveryPort, "255.255.255.255");
    });
  });
}
