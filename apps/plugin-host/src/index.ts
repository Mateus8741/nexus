import { AttachDeviceProviderUseCase } from "@nexus/application";
import type { DeviceEvent } from "@nexus/domain";
import { InMemoryDeviceRegistry, WebSocketAgentGateway } from "@nexus/infrastructure";
import { createWindowsPlugin } from "@nexus/plugin-windows";
import {
  type PluginCandidate,
  PluginLoader,
  PluginRegistry,
  type PluginSource,
} from "@nexus/plugins-sdk";

import { EventLog } from "./http/event-log";
import { createHttpServer } from "./http/server";
import { createConsoleLogger } from "./runtime/console-logger";

/**
 * @nexus/plugin-host — composition root do Nexus.
 *
 * Este é o ÚNICO arquivo do monorepo autorizado a conhecer, ao mesmo tempo,
 * uma abstração (PluginRegistry, DeviceRegistry, AgentGateway) e uma
 * implementação concreta dela (InMemoryDeviceRegistry, WebSocketAgentGateway)
 * — e o único que importa @nexus/plugin-windows diretamente. Todo o resto
 * do sistema (a própria classe WindowsDeviceProvider, o
 * AttachDeviceProviderUseCase, o DeviceRegistry) só enxerga interfaces.
 */

const AGENT_GATEWAY_PORT = Number(process.env.NEXUS_AGENT_GATEWAY_PORT ?? 4600);
const HTTP_PORT = Number(process.env.NEXUS_HTTP_PORT ?? 4700);

async function bootstrap(): Promise<void> {
  const logger = createConsoleLogger("plugin-host");

  const deviceRegistry = new InMemoryDeviceRegistry();
  const agentGateway = new WebSocketAgentGateway({ port: AGENT_GATEWAY_PORT });
  const pluginRegistry = new PluginRegistry();
  const pluginLoader = new PluginLoader(pluginRegistry);
  const attachDeviceProvider = new AttachDeviceProviderUseCase(deviceRegistry, (error, event) => {
    logger.error(
      `Falha ao processar DeviceEvent "${event.type}" (${event.deviceId}): ${String(error)}`,
    );
  });

  const { plugin: windowsPlugin, provider: windowsProvider } = createWindowsPlugin({
    agentGateway,
  });

  // Nesta etapa o Windows plugin é "embutido" (conhecido de antemão), não
  // descoberto de disco/rede — é isso que um PluginSource real (varrendo
  // packages/plugins/* em disco) faria no lugar disto no futuro.
  const source: PluginSource = {
    discover(): PluginCandidate[] {
      return [{ source: "built-in:@nexus/plugin-windows", value: windowsPlugin }];
    },
  };

  const loadResult = await pluginLoader.loadAll(source);
  for (const rejection of loadResult.rejected) {
    logger.error(`Falha ao carregar plugin de "${rejection.source}": ${rejection.reason}`);
  }

  deviceRegistry.subscribe((event: DeviceEvent) => {
    logger.info(`[device-registry] ${event.type} — dispositivo ${event.deviceId}`);
  });

  // Liga o provider ao registry ANTES de iniciar o plugin, para não perder
  // nenhum evento emitido logo no onStart (ex.: reconexões imediatas).
  await attachDeviceProvider.attach(windowsProvider);

  for (const plugin of loadResult.loaded) {
    const pluginLogger = createConsoleLogger(plugin.manifest.id);
    pluginRegistry.setState(plugin.manifest.id, "starting");
    await plugin.onStart({ logger: pluginLogger, config: plugin.manifest.config ?? {} });
    pluginRegistry.setState(plugin.manifest.id, "started");
  }

  // EventLog é só um buffer circular de DeviceEvent — o DeviceRegistry só
  // guarda o snapshot vivo de cada Device, não histórico. Assina o registry
  // antes de subir o servidor HTTP para não perder eventos entre os dois.
  const eventLog = new EventLog(deviceRegistry);

  // Servidor HTTP somente-leitura para o Dashboard (apps/web) consumir via
  // fetch Node→Node — processo separado, não pode importar estas classes
  // diretamente. `providers` é um array de propósito: hoje só o Windows,
  // mas nenhum outro provider (Docker, Home Assistant, Tuya...) vai exigir
  // mudar a assinatura de createHttpServer.
  const httpServer = createHttpServer({
    deviceRegistry,
    pluginRegistry,
    providers: [windowsProvider],
    eventLog,
  });
  httpServer.listen(HTTP_PORT);

  logger.info(`Pronto. Aguardando Agents em ws://localhost:${AGENT_GATEWAY_PORT}`);
  logger.info(`API HTTP disponível em http://localhost:${HTTP_PORT}`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Recebido ${signal}, encerrando...`);
    for (const plugin of loadResult.loaded) {
      pluginRegistry.setState(plugin.manifest.id, "stopping");
      await plugin.onStop({
        logger: createConsoleLogger(plugin.manifest.id),
        config: plugin.manifest.config ?? {},
      });
      pluginRegistry.setState(plugin.manifest.id, "stopped");
    }
    await agentGateway.close();
    httpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  console.error("[plugin-host] erro fatal na inicialização:", error);
  process.exit(1);
});
