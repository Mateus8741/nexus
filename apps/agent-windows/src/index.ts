import os from "node:os";
import { WindowsAgent } from "./agent";
import { getOrCreateAgentId } from "./agent-id";
import { readPersistedConfig } from "./config";
import { discoverCore } from "./discovery";
import { createSystemActions } from "./system-actions";

/**
 * @nexus/agent-windows — processo standalone que roda NA máquina Windows
 * monitorada, separado da aplicação principal (apps/plugin-host). Coleta
 * métricas, se registra automaticamente e executa ações vindas do Core.
 *
 * Configuração, em ordem de prioridade: variáveis de ambiente
 * (NEXUS_CORE_URL/NEXUS_DEVICE_NAME) → config persistida por
 * scripts/install.ps1 na instalação (ver ./config.ts) → descoberta
 * automática via broadcast UDP na rede local (ver ./discovery.ts) → falha
 * com instruções. O caso comum, depois de instalado via install.ps1, nunca
 * chega além do segundo passo — é isso que permite rodar sem digitar
 * comando nenhum numa máquina nova (ver README.md).
 */

async function main(): Promise<void> {
  const persisted = readPersistedConfig();

  const deviceName = process.env.NEXUS_DEVICE_NAME ?? persisted.deviceName ?? os.hostname();
  const agentId = getOrCreateAgentId();

  let coreUrl = process.env.NEXUS_CORE_URL ?? persisted.coreUrl;
  if (!coreUrl) {
    console.log("[agent-windows] NEXUS_CORE_URL não definido, procurando o Core na rede local...");
    const found = await discoverCore();
    if (!found) {
      console.error(
        "[agent-windows] Não encontrei o Core automaticamente na rede local (tentei por 3s).\n" +
          "A descoberta automática só funciona quando o Core está na mesma rede local (broadcast " +
          "UDP não atravessa a internet) — se o Core estiver hospedado na nuvem (ex.: Coolify), " +
          "isso é esperado: use sempre NEXUS_CORE_URL manualmente nesse caso, ou instale via " +
          "scripts/install.ps1 (ver README.md) para não precisar disso de novo.\n" +
          "Defina NEXUS_CORE_URL e rode de novo, ex.:\n" +
          "  set NEXUS_CORE_URL=ws://192.168.1.10:4700          (Core na rede local)\n" +
          "  set NEXUS_CORE_URL=wss://core.seudominio.com       (Core na nuvem, com TLS)",
      );
      process.exitCode = 1;
      return;
    }
    coreUrl = `ws://${found.host}:${found.port}`;
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
