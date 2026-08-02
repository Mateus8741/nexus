import os from "node:os";
import { WindowsAgent } from "./agent";
import { getOrCreateAgentId } from "./agent-id";
import { discoverCore } from "./discovery";
import { createSystemActions } from "./system-actions";

/**
 * @nexus/agent-windows — processo standalone que roda NA máquina Windows
 * monitorada, separado da aplicação principal (apps/plugin-host). Coleta
 * métricas, se registra automaticamente e executa ações vindas do Core.
 *
 * Configuração via variáveis de ambiente: NEXUS_CORE_URL e
 * NEXUS_DEVICE_NAME (padrão: hostname da máquina). Se NEXUS_CORE_URL não
 * for definido, o Agent tenta descobrir o Core sozinho via broadcast UDP
 * na rede local (ver ./discovery.ts) antes de desistir.
 */

async function main(): Promise<void> {
  const deviceName = process.env.NEXUS_DEVICE_NAME ?? os.hostname();
  const agentId = getOrCreateAgentId();

  let coreUrl = process.env.NEXUS_CORE_URL;
  if (!coreUrl) {
    console.log("[agent-windows] NEXUS_CORE_URL não definido, procurando o Core na rede local...");
    const found = await discoverCore();
    if (!found) {
      console.error(
        "[agent-windows] Não encontrei o Core automaticamente na rede local (tentei por 3s).\n" +
          "Isso pode acontecer se o Core não estiver rodando, se um firewall estiver bloqueando " +
          "broadcast UDP, ou se as máquinas estiverem em sub-redes diferentes.\n" +
          "Defina NEXUS_CORE_URL manualmente e rode de novo, ex.:\n" +
          "  set NEXUS_CORE_URL=ws://192.168.1.10:4600",
      );
      process.exitCode = 1;
      return;
    }
    coreUrl = `ws://${found.host}:${found.wsPort}`;
    console.log(`[agent-windows] Core encontrado em ${coreUrl}`);
  }

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
}

main().catch((error: unknown) => {
  console.error("[agent-windows] erro fatal na inicialização:", error);
  process.exit(1);
});
