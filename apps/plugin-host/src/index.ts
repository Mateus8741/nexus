import {
  ApproveAgentUseCase,
  AttachDeviceProviderUseCase,
  CreateApiKeyUseCase,
  CreateMembershipUseCase,
  CreateProviderAccountUseCase,
  CreateSpaceUseCase,
  ExecuteDeviceActionUseCase,
  ListAgentsUseCase,
  ListApiKeysUseCase,
  ListAuditLogsUseCase,
  ListPersistedEventsUseCase,
  ListProviderAccountsUseCase,
  ListRolesUseCase,
  ListSpacesUseCase,
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
  PostgresProviderAccountRepository,
  PostgresRoleRepository,
  PostgresSpaceRepository,
  TimerHealthMonitor,
  WebSocketAgentGateway,
} from "@nexus/infrastructure";
import { createTuyaPlugin } from "@nexus/plugin-tuya";
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

// Tuya (opcional): só ativa o plugin se as três variáveis obrigatórias
// estiverem presentes — ambientes sem Tuya configurado seguem funcionando
// normalmente sem esse provider (ver README.md / .env.example).
const TUYA_ACCESS_ID = process.env.TUYA_ACCESS_ID;
const TUYA_ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;
const TUYA_UID = process.env.TUYA_UID;
const TUYA_ENDPOINT = process.env.TUYA_ENDPOINT;
const TUYA_POLL_INTERVAL_MS = process.env.TUYA_POLL_INTERVAL_MS
  ? Number(process.env.TUYA_POLL_INTERVAL_MS)
  : undefined;

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
  const spaceRepository = new PostgresSpaceRepository(db);
  const providerAccountRepository = new PostgresProviderAccountRepository(db);

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
  const createSpace = new CreateSpaceUseCase(spaceRepository, permissionService);
  const listSpaces = new ListSpacesUseCase(spaceRepository, permissionService);
  const createMembership = new CreateMembershipUseCase(memberships, permissionService);
  const createProviderAccount = new CreateProviderAccountUseCase(
    providerAccountRepository,
    permissionService,
  );
  const listProviderAccounts = new ListProviderAccountsUseCase(
    providerAccountRepository,
    permissionService,
  );

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
    roles,
    spaces: spaceRepository,
    createSpace,
    listSpaces,
    createMembership,
    createProviderAccount,
    listProviderAccounts,
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

  // Contas Tuya vêm do Postgres (provider_accounts), não mais de uma única
  // env var — isso é o que permite múltiplas pessoas, cada uma com sua
  // própria conta Smart Life isolada num Space (ver ProviderAccount em
  // @nexus/domain). TUYA_UID (env var legada) é migrada automaticamente
  // para uma linha em provider_accounts na primeira vez que o Core sobe com
  // ela definida, presa ao primeiro Space do workspace — assim o deploy já
  // existente continua funcionando sem exigir nenhuma ação manual. Contas
  // adicionais (para outras pessoas/ambientes) são cadastradas via
  // POST /provider-accounts.
  if (TUYA_ACCESS_ID && TUYA_ACCESS_SECRET && TUYA_UID) {
    const existingTuyaAccounts = await providerAccountRepository.listByProvider("nexus.tuya");
    const alreadyMigrated = existingTuyaAccounts.some((account) => account.externalId === TUYA_UID);
    if (!alreadyMigrated) {
      const workspaceSpaces = await spaceRepository.listByWorkspace(workspaceId);
      const defaultSpace = workspaceSpaces[0];
      if (defaultSpace) {
        await providerAccountRepository.create({
          id: crypto.randomUUID(),
          workspaceId,
          spaceId: defaultSpace.id,
          providerId: "nexus.tuya",
          externalId: TUYA_UID,
          label: "Migrado de TUYA_UID",
          createdAt: new Date(),
        });
        logger.info(
          `Conta Tuya (uid=${TUYA_UID}) migrada da env var TUYA_UID para o Space "${defaultSpace.name}".`,
        );
      }
    }
  }

  const tuyaAccounts = (await providerAccountRepository.listByProvider("nexus.tuya")).map(
    (account) => ({ uid: account.externalId, spaceId: account.spaceId }),
  );

  const tuyaEnabled = Boolean(TUYA_ACCESS_ID && TUYA_ACCESS_SECRET && tuyaAccounts.length > 0);
  const tuyaBundle = tuyaEnabled
    ? createTuyaPlugin({
        accessId: TUYA_ACCESS_ID as string,
        accessSecret: TUYA_ACCESS_SECRET as string,
        accounts: tuyaAccounts,
        endpoint: TUYA_ENDPOINT,
        pollIntervalMs: TUYA_POLL_INTERVAL_MS,
        capabilityRegistry,
      })
    : undefined;
  if (tuyaBundle) {
    providers.push(tuyaBundle.provider);
    deviceProviderRegistry.register(tuyaBundle.provider);
  } else {
    logger.info(
      "Tuya plugin desativado — defina TUYA_ACCESS_ID, TUYA_ACCESS_SECRET e ao menos uma conta (TUYA_UID ou provider_accounts) para ativar (ver .env.example).",
    );
  }

  const source: PluginSource = {
    discover(): PluginCandidate[] {
      const candidates: PluginCandidate[] = [
        { source: "built-in:@nexus/plugin-windows", value: windowsPlugin },
      ];
      if (tuyaBundle) {
        candidates.push({ source: "built-in:@nexus/plugin-tuya", value: tuyaBundle.plugin });
      }
      return candidates;
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
  if (tuyaBundle) {
    await attachDeviceProvider.attach(tuyaBundle.provider);
  }

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
