import type { Server as HttpServer } from "node:http";

import type { AgentConnection, AgentGateway } from "@nexus/plugins-sdk";
import type { RawData, WebSocket } from "ws";
import { WebSocketServer } from "ws";

/**
 * Duas formas de expor o WebSocket:
 *
 * - `{ port }` — sobe um servidor TCP próprio, dedicado. Simples para rodar
 *   localmente, mas exige uma porta extra exposta — problemático atrás de um
 *   reverse proxy que só encaminha um domínio para uma única porta HTTP
 *   (ex.: Coolify/Traefik).
 * - `{ server, path? }` — "pluga" no upgrade de um `http.Server` já
 *   existente (ex.: o mesmo servidor da API HTTP do plugin-host). Upgrades
 *   HTTP→WebSocket acontecem sobre o mesmo host/porta que o resto do
 *   tráfego HTTP, então um único domínio/porta exposta pelo Coolify basta
 *   para os dois. `path` filtra quais requisições de upgrade este gateway
 *   aceita (default: aceita qualquer path — ok quando o servidor não serve
 *   mais nada além disto).
 */
export type WebSocketAgentGatewayOptions =
  | { readonly port: number }
  | { readonly server: HttpServer; readonly path?: string };

/**
 * Implementação concreta de AgentGateway (@nexus/plugins-sdk) usando um
 * servidor WebSocket (`ws`). É a única classe deste pacote que sabe que o
 * transporte é WebSocket — todo consumidor (WindowsDeviceProvider, um
 * futuro LinuxDeviceProvider) só conhece a interface AgentGateway.
 *
 * Sem autenticação nesta etapa: qualquer processo que conseguir abrir o
 * socket é tratado como um Agent válido. Ver ARCHITECTURE.md — pendência
 * de segurança antes de expor essa porta fora de localhost/rede confiável.
 */
export class WebSocketAgentGateway implements AgentGateway {
  private readonly server: WebSocketServer;
  private readonly listeners = new Set<(connection: AgentConnection) => void>();
  private nextConnectionId = 1;

  constructor(options: WebSocketAgentGatewayOptions) {
    this.server =
      "server" in options
        ? new WebSocketServer({ server: options.server, path: options.path })
        : new WebSocketServer({ port: options.port });
    this.server.on("connection", (socket) => {
      const connection = this.wrap(socket);
      for (const listener of this.listeners) {
        listener(connection);
      }
    });
  }

  onConnection(listener: (connection: AgentConnection) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Encerra o servidor WebSocket. Não faz parte da interface AgentGateway — é o dono concreto do recurso (o composition root) quem deve chamar isto no shutdown. */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  private wrap(socket: WebSocket): AgentConnection {
    const id = `ws-${this.nextConnectionId++}`;

    return {
      id,
      send(message: unknown): void {
        socket.send(JSON.stringify(message));
      },
      close(code?: number, reason?: string): void {
        socket.close(code, reason);
      },
      onMessage(listener: (message: unknown) => void): () => void {
        const handler = (data: RawData) => {
          try {
            listener(JSON.parse(data.toString()));
          } catch {
            // Mensagem não é JSON válido — ignorada. Quem entende o protocolo
            // (ex.: WindowsDeviceProvider, via isAgentMessage) é responsável
            // por validar a FORMA da mensagem; aqui só garantimos que é JSON.
          }
        };
        socket.on("message", handler);
        return () => socket.off("message", handler);
      },
      onClose(listener: (info: { code?: number; reason?: string }) => void): () => void {
        const handler = (code: number, reason: Buffer) => {
          listener({ code, reason: reason.toString() });
        };
        socket.on("close", handler);
        return () => socket.off("close", handler);
      },
    };
  }
}
