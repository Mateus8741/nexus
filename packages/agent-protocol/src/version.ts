/**
 * Versão do protocolo de mensagens entre o Core (um DeviceProvider baseado em
 * Agent, ex.: @nexus/plugin-windows) e um Agent remoto (ex.: apps/agent-windows).
 *
 * Independente da versão do próprio pacote @nexus/agent-protocol — essa
 * constante é o que viaja dentro de cada mensagem `register`, para permitir
 * no futuro que Core e Agent negociem/recusem versões incompatíveis mesmo
 * rodando builds diferentes (o Agent pode estar rodando há meses numa
 * máquina Windows enquanto o Core é atualizado).
 */
export const AGENT_PROTOCOL_VERSION = "1.0.0";
