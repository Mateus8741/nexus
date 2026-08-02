/**
 * AgentGateway — porta que expõe ao plugin "aceitar conexões de agents
 * remotos", sem dizer como isso acontece de verdade.
 *
 * Deliberadamente agnóstico de transporte: WebSocket é só uma implementação
 * possível (@nexus/infrastructure/WebSocketAgentGateway). Um teste pode usar
 * uma implementação in-memory; uma versão futura poderia usar outro
 * transporte sem que nenhum plugin precisasse mudar uma linha.
 *
 * Faz parte do "kernel API" do SDK (mesmo grupo de Plugin/PluginContext)
 * porque é algo que o HOST injeta/cria e o PLUGIN só consome — nunca o
 * contrário. Plugins no "padrão Agent" (Windows hoje; Linux/macOS amanhã)
 * recebem uma instância já pronta via factory (ex.: createWindowsPlugin),
 * nunca criam a sua própria.
 */
export interface AgentConnection {
  /** Identificador da conexão em si (nível de transporte) — não confundir com o id do Agent/Device, que só é conhecido depois da mensagem `register`. */
  readonly id: string;

  send(message: unknown): void;
  close(code?: number, reason?: string): void;

  /** `message` chega como `unknown` de propósito — validar o formato é responsabilidade de quem entende o protocolo (ex.: @nexus/agent-protocol), não do transporte. */
  onMessage(listener: (message: unknown) => void): () => void;
  onClose(listener: (info: { code?: number; reason?: string }) => void): () => void;
}

export interface AgentGateway {
  /** Chamado a cada novo Agent remoto que se conecta. Retorna uma função para cancelar a assinatura. */
  onConnection(listener: (connection: AgentConnection) => void): () => void;
}
