import {
  ApproveAgentUseCase,
  AttachDeviceProviderUseCase,
  CreateApiKeyUseCase,
  ExecuteDeviceActionUseCase,
  ListAgentsUseCase,
  ListApiKeysUseCase,
  ListAuditLogsUseCase,
  ListPersistedEventsUseCase,
  ListRolesUseCase,
  ListUsersUseCase,
  MarkAgentConnectedUseCase,
  NotificationCenter,
  RegisterAgentUseCase,
  RevokeAgentUseCase,
  RevokeApiKeyUseCase,
  RotateAgentTokenUseCase,
} from "@nexus/application";
import { createAuth, ensureDefaultWorkspace, seedPermissions } from "@nexus/auth";
import { createDb } from "@nexus/db";
import type { DeviceProvider, SystemEvent } from "@nexus/domain";
import {
  ConsoleNotificationChannel,
  InMemoryCapabilityRegistry,
  InMemoryDeviceProviderRegistry,
  InMemoryEventBus,
  InMemoryScheduler,
  PersistingDeviceRegistry,
  PersistingEventBus,
  PostgresAgentRegistrationRepository,
  PostgresApiKeyRepository,
  PostgresAuditLog,
  PostgresDeviceRepository,
  PostgresEventStore,
  PostgresMembershipRepository,
  PostgresPermissionService,
  PostgresRoleRepository,
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

import { AgentPairingBridge } from "./agents/agent-pairing-bridge";
import { DiscoveryResponder } from "./discovery/discovery-responder";
import { createHttpServer } from "./http/server";
import { createConsoleLogger } from "./runtime/console-logger";

const PORT = Number(process.env.PORT ?? process.env.NEXUS_HTTP_PORT ?? 4700);
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://nexus:nexus@localhost:5432/nexus";
const BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ?? "dev-only-change-me-nexus-auth-secret-32chars";
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? `http://localhost:${PORT}`;
const TRUSTED_ORIGINS = (
  process.env.NEXUS_TRUSTED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000"
).split(",");
const COOKIE_DOMAIN = process.env.BETTER_AUTH_COOKIE_DOMAIN;

async function bootstrap(): Promise<void> {
  const logger = createConsoleLogger("plugin-host");

  const db = createDb({ connectionString: DATABASE_URL });
  await seedPermissions(db);
  const { workspaceId } = await ensureDefaultWorkspace(db);

  const innerBus = new InMemoryEventBus<SystemEvent>();
  const eventStore = new PostgresEventStore(db);
  const eventBus = new PersistingEventBus(innerBus, eventStore, workspaceId);

  const deviceRepository = new PostgresDeviceRepository(db);
  const deviceRegistry = new PersistingDeviceRegistry(eventBus, deviceRepository, workspaceId);
  await deviceRegistry.hydrate();

  const deviceProviderRegistry = new InMemoryDeviceProviderRegistry();
  const capabilityRegistry = new InMemoryCapabilityRegistry();
  const timerHealthMonitor = new TimerHealthMonitor();
  const scheduler = new InMemoryScheduler();
  void scheduler;

  const notificationCenter = new NotificationCenter();
  notificationCenter.registerChannel(new ConsoleNotificationChannel());

  const auditLog = new PostgresAuditLog(db, eventBus);
  const permissionService = new PostgresPermissionService(db, eventBus);
  const memberships = new PostgresMembershipRepository(db);
  const roles = new PostgresRoleRepository(db);
  const agents = new PostgresAgentRegistrationRepository(db);
  const apiKeys = new PostgresApiKeyRepository(db);

  const auth = createAuth({
    db,
    baseURL: BETTER_AUTH_URL,
    secret: BETTER_AUTH_SECRET,
    trustedOrigins: TRUSTED_ORIGINS,
    cookieDomain: COOKIE_DOMAIN,
  });

  const executeDeviceAction = new ExecuteDeviceActionUseCase(
    deviceRegistry,
    deviceProviderRegistry,
    permissionService,
    eventBus,
  );

  const registerAgent = new RegisterAgentUseCase(agents, eventBus);
  const approveAgent = new ApproveAgentUseCase(agents, permissionService, eventBus);
  const revokeAgent = new RevokeAgentUseCase(agents, permissionService, eventBus);
  const rotateAgentToken = new RotateAgentTokenUseCase(agents, permissionService);
  const markConnected = new MarkAgentConnectedUseCase(agents, eventBus);
  const createApiKey = new CreateApiKeyUseCase(apiKeys, permissionService);
  const revokeApiKey = new RevokeApiKeyUseCase(apiKeys, permissionService);
  const listUsers = new ListUsersUseCase(memberships, permissionService);
  const listRoles = new ListRolesUseCase(roles, permissionService);
  const listAgents = new ListAgentsUseCase(agents, permissionService);
  const listApiKeys = new ListApiKeysUseCase(apiKeys, permissionService);
  const listAudit = new ListAuditLogsUseCase(auditLog, permissionService);
  const listEvents = new ListPersistedEventsUseCase(eventStore, permissionService);

  const pluginRegistry = new PluginRegistry();
  const pluginLoader = new PluginLoader(pluginRegistry);
  const attachDeviceProvider = new AttachDeviceProviderUseCase(deviceRegistry, (error, event) => {
    logger.error(
      `Falha ao processar DeviceEvent "${event.type}" (${event.deviceId}): ${String(error)}`,
    );
  });

  const providers: DeviceProvider[] = [];
  const pairingRef: { current: AgentPairingBridge | null } = { current: null };

  const resolveActorDeps = {
    auth,
    memberships,
    apiKeys,
    eventBus,
    defaultWorkspaceId: workspaceId,
  };

  const httpServer = createHttpServer({
    db,
    auth,
    resolveActorDeps,
    deviceRegistry,
    pluginRegistry,
    providers,
    auditLog,
    capabilityRegistry,
    executeDeviceAction,
    permissionService,
    eventBus,
    listUsers,
    listRoles,
    listAgents,
    listApiKeys,
    listAudit,
    listEvents,
    approveAgent,
    revokeAgent,
    rotateAgentToken,
    createApiKey,
    revokeApiKey,
    get pairingBridge() {
      if (!pairingRef.current) {
        throw new Error("AgentPairingBridge ainda não inicializado");
      }
      return pairingRef.current;
    },
    defaultWorkspaceId: workspaceId,
  });

  const agentGateway = new WebSocketAgentGateway({ server: httpServer });
  const pairingBridge = new AgentPairingBridge(
    agentGateway,
    workspaceId,
    registerAgent,
    markConnected,
    agents,
    eventBus,
  );
  pairingRef.current = pairingBridge;

  const { plugin: windowsPlugin, provider: windowsProvider } = createWindowsPlugin({
    agentGateway: pairingBridge,
    healthMonitor: timerHealthMonitor,
    capabilityRegistry,
  });
  providers.push(windowsProvider);
  deviceProviderRegistry.register(windowsProvider);

  const source: PluginSource = {
    discover(): PluginCandidate[] {
      return [{ source: "built-in:@nexus/plugin-windows", value: windowsPlugin }];
    },
  };

  const loadResult = await pluginLoader.loadAll(source);
  for (const rejection of loadResult.rejected) {
    logger.error(`Falha ao carregar plugin de "${rejection.source}": ${rejection.reason}`);
  }

  eventBus.subscribe((event) => {
    if ("deviceId" in event) {
      logger.info(`[event-bus] ${event.type} — dispositivo ${event.deviceId}`);
    } else if ("pluginId" in event) {
      logger.info(`[event-bus] ${event.type} — plugin ${event.pluginId}`);
    } else {
      logger.info(`[event-bus] ${event.type}`);
    }
  });

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
      workspaceId,
    });
  }

  httpServer.listen(PORT);

  const discoveryResponder = new DiscoveryResponder({ port: PORT });
  discoveryResponder.start();

  logger.info(`Pronto. HTTP + WebSocket autenticados em http://localhost:${PORT}`);
  logger.info(`Workspace default: ${workspaceId}`);

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
        workspaceId,
      });
    }
    await eventBus.flush();
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
