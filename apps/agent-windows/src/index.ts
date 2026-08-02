import os from "node:os";
import { WindowsAgent } from "./agent";
import { getOrCreateAgentId } from "./agent-id";
import { createSystemActions } from "./system-actions";

/**
 * @nexus/agent-windows — processo standalone que roda NA máquina Windows
 * monitorada, separado da aplicação principal (apps/plugin-host). Coleta
 * métricas, se registra automaticamente e executa ações vindas do Core.
 *
 * Configuração via variáveis de ambiente (sem arquivo de config nesta
 * etapa): NEXUS_CORE_URL (padrão ws://localhost:4600) e NEXUS_DEVICE_NAME
 * (padrão: hostname da máquina).
 */

const coreUrl = process.env.NEXUS_CORE_URL ?? "ws://localhost:4600";
const deviceName = process.env.NEXUS_DEVICE_NAME ?? os.hostname();
const agentId = getOrCreateAgentId();

const agent = new WindowsAgent({
  coreUrl,
  agentId,
  deviceName,
  systemActions: createSystemActions(),
});

agent.start();

process.on("SIGINT", () => {
  console.log("[agent-windows] encerrando...");
  agent.stop();
  process.exit(0);
});
