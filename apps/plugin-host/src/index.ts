import { AttachDeviceProviderUseCase } from "@nexus/application";
import type { DeviceEvent, DeviceProvider } from "@nexus/domain";
import { InMemoryDeviceRegistry, WebSocketAgentGateway } from "@nexus/infrastructure";
import { createWindowsPlugin } from "@nexus/plugin-windows";
import {
  type PluginCandidate,
  PluginLoader,
  PluginRegistry,
  type PluginSource,
} from "@nexus/plugins-sdk";

import { DiscoveryResponder } from "./discovery/discovery-responder";
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
 *
 * HTTP (API para o Dashboard) e WebSocket (Agents remotos) rodam na MESMA
 * porta/processo: o upgrade HTTP→WebSocket é anexado ao mesmo `http.Server`
 * que serve as rotas REST (ver WebSocketAgentGateway com `{ server }` em vez
 * de `{ port }`). Isso existe para caber atrás de um reverse proxy que só
 * expõe uma porta por domínio (ex.: Coolify/Traefik) — só uma porta para
 * abrir/mapear, em vez de duas.
 */

// `PORT` é a convenção mais comum entre PaaS (Coolify, Heroku, Railway...);
// `NEXUS_HTTP_PORT` continua valendo para quem prefere ser explícito.
const PORT = Number(process.env.PORT ?? process.env.NEXUS_HTTP_PORT ?? 4700);

async function bootstrap(): Promise<void> {
  const logger = createConsoleLogger("plugin-host");

  const deviceRegistry = new InMemoryDeviceRegistry();
  const pluginRegistry = new PluginRegistry();
  const pluginLoader = new PluginLoader(pluginRegistry);
  const attachDeviceProvider = new AttachDeviceProviderUseCase(deviceRegistry, (error, event) => {
    logger.error(
      `Falha ao processar DeviceEvent "${event.type}" (${event.deviceId}): ${String(error)}`,
    );
  });

  // EventLog só depende do deviceRegistry — pode existir desde já. `providers`
  // é preenchido logo abaixo, DEPOIS que o WindowsDeviceProvider existir
  // (que por sua vez depende do agentGateway, que depende do httpServer) —
  // ainda assim antes do servidor começar a aceitar conexões (`.listen()`),
  // então a rota GET /providers nunca vê o array vazio em produção.
  const eventLog = new EventLog(deviceRegistry);
  const providers: DeviceProvider[] = [];

  const httpServer = createHttpServer({ deviceRegistry, pluginRegistry, providers, eventLog });

  // O AgentGateway "pluga" no upgrade HTTP→WebSocket do MESMO servidor —
  // ver comentário no topo do arquivo.
  const agentGateway = new WebSocketAgentGateway({ server: httpServer });

  const { plugin: windowsPlugin, provider: windowsProvider } = createWindowsPlugin({
    agentGateway,
  });
  providers.push(windowsProvider);

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

  httpServer.listen(PORT);

  // Responde em UDP broadcast a Agents perguntando "onde está o Core?" —
  // só é útil quando Agent e Core estão na mesma rede local (broadcast não
  // atravessa a internet); num deploy na nuvem, o Agent sempre precisa de
  // NEXUS_CORE_URL manual (wss://...) — ver apps/agent-windows/src/discovery.ts.
  const discoveryResponder = new DiscoveryResponder({ port: PORT });
  discoveryResponder.start();

  logger.info(`Pronto. HTTP + WebSocket de Agents em http://localhost:${PORT} (mesma porta)`);

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
    await discoveryResponder.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  console.error("[plugin-host] erro fatal na inicialização:", error);
  process.exit(1);
});
