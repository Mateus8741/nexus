import {
  AttachDeviceProviderUseCase,
  ExecuteDeviceActionUseCase,
  NotificationCenter,
} from "@nexus/application";
import type { DeviceProvider, SystemEvent } from "@nexus/domain";
import {
  ConsoleNotificationChannel,
  InMemoryAuditLog,
  InMemoryCapabilityRegistry,
  InMemoryDeviceProviderRegistry,
  InMemoryDeviceRegistry,
  InMemoryEventBus,
  InMemoryScheduler,
  TimerHealthMonitor,
  WebSocketAgentGateway,
} from "@nexus/infrastructure";
import { createWindowsPlugin } from "@nexus/plugin-windows";
import {
  type PluginCandidate,
  PluginLoader,
  PluginRegistry,
  type PluginSource,
} from "@nexus/plugins-sdk";

import { DiscoveryResponder } from "./discovery/discovery-responder";
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

  // EventBus único do processo — TUDO que acontece no Core (eventos de
  // dispositivo, ciclo de vida de plugin, registro de capability) passa por
  // aqui. Ver ARCHITECTURE.md, "Event Bus".
  const eventBus = new InMemoryEventBus<SystemEvent>();

  const deviceRegistry = new InMemoryDeviceRegistry(eventBus);
  const deviceProviderRegistry = new InMemoryDeviceProviderRegistry();
  const capabilityRegistry = new InMemoryCapabilityRegistry();
  const timerHealthMonitor = new TimerHealthMonitor();
  // Só instanciado nesta etapa (infra "provada", sem nenhum job real
  // agendado ainda) — ver ARCHITECTURE.md, "Scheduler".
  const scheduler = new InMemoryScheduler();
  const notificationCenter = new NotificationCenter();
  notificationCenter.registerChannel(new ConsoleNotificationChannel());
  // Nenhum job real agendado ainda (ver comentário acima) — referenciado aqui
  // só para deixar explícito que a variável existe de propósito, não por
  // descuido.
  void scheduler;

  // AuditLog substitui o antigo EventLog: assina o EventBus inteiro (não só
  // eventos de dispositivo), então plugin.loaded/plugin.unloaded aparecem no
  // mesmo histórico que device.connected/etc.
  const auditLog = new InMemoryAuditLog(eventBus);

  const executeDeviceAction = new ExecuteDeviceActionUseCase(
    deviceRegistry,
    deviceProviderRegistry,
  );

  const pluginRegistry = new PluginRegistry();
  const pluginLoader = new PluginLoader(pluginRegistry);
  const attachDeviceProvider = new AttachDeviceProviderUseCase(deviceRegistry, (error, event) => {
    logger.error(
      `Falha ao processar DeviceEvent "${event.type}" (${event.deviceId}): ${String(error)}`,
    );
  });

  // `providers` é preenchido logo abaixo, DEPOIS que o WindowsDeviceProvider
  // existir (que por sua vez depende do agentGateway, que depende do
  // httpServer) — ainda assim antes do servidor começar a aceitar conexões
  // (`.listen()`), então a rota GET /providers nunca vê o array vazio em
  // produção.
  const providers: DeviceProvider[] = [];

  const httpServer = createHttpServer({
    deviceRegistry,
    pluginRegistry,
    providers,
    auditLog,
    capabilityRegistry,
    executeDeviceAction,
  });

  // O AgentGateway "pluga" no upgrade HTTP→WebSocket do MESMO servidor —
  // ver comentário no topo do arquivo.
  const agentGateway = new WebSocketAgentGateway({ server: httpServer });

  const { plugin: windowsPlugin, provider: windowsProvider } = createWindowsPlugin({
    agentGateway,
    healthMonitor: timerHealthMonitor,
    capabilityRegistry,
  });
  providers.push(windowsProvider);
  deviceProviderRegistry.register(windowsProvider);

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

  // Único ponto de log de eventos: assina o EventBus inteiro (não só o
  // deviceRegistry) — é o que evidencia, em runtime, que device.*,
  // plugin.loaded/unloaded e capability.registered passam todos pelo MESMO
  // barramento (ver ARCHITECTURE.md, "Event Bus"). Substitui o antigo
  // `deviceRegistry.subscribe(...)` (que só via eventos de dispositivo) para
  // não duplicar log da mesma ocorrência em dois assinantes.
  eventBus.subscribe((event) => {
    // Todo SystemEvent que não é DeviceEvent (plugin.loaded/unloaded,
    // capability.registered) carrega `pluginId` — não sobra um terceiro
    // formato a tratar hoje.
    if ("deviceId" in event) {
      logger.info(`[event-bus] ${event.type} — dispositivo ${event.deviceId}`);
    } else {
      logger.info(`[event-bus] ${event.type} — plugin ${event.pluginId}`);
    }
  });

  // Liga o provider ao registry ANTES de iniciar o plugin, para não perder
  // nenhum evento emitido logo no onStart (ex.: reconexões imediatas).
  await attachDeviceProvider.attach(windowsProvider);

  for (const plugin of loadResult.loaded) {
    const pluginLogger = createConsoleLogger(plugin.manifest.id);
    pluginRegistry.setState(plugin.manifest.id, "starting");
    await plugin.onStart({ logger: pluginLogger, config: plugin.manifest.config ?? {} });
    pluginRegistry.setState(plugin.manifest.id, "started");
    eventBus.publish({
      type: "plugin.loaded",
      pluginId: plugin.manifest.id,
      occurredAt: new Date(),
    });
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
      eventBus.publish({
        type: "plugin.unloaded",
        pluginId: plugin.manifest.id,
        occurredAt: new Date(),
      });
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
