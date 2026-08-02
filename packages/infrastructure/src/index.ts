/**
 * @nexus/infrastructure — Camada de Infraestrutura
 */

export { ConsoleNotificationChannel } from "./adapters/console-notification-channel";
export { PostgresPermissionService } from "./auth/postgres-permission-service";
export { InMemoryEventBus } from "./messaging/in-memory-event-bus";
export { PersistingEventBus } from "./messaging/persisting-event-bus";
export {
  WebSocketAgentGateway,
  type WebSocketAgentGatewayOptions,
} from "./messaging/websocket-agent-gateway";
export { InMemoryAuditLog } from "./persistence/in-memory-audit-log";
export { InMemoryCapabilityRegistry } from "./persistence/in-memory-capability-registry";
export { InMemoryDeviceProviderRegistry } from "./persistence/in-memory-device-provider-registry";
export { InMemoryDeviceRegistry } from "./persistence/in-memory-device-registry";
export { PersistingDeviceRegistry } from "./persistence/persisting-device-registry";
export { PostgresAgentRegistrationRepository } from "./persistence/postgres-agent-registration-repository";
export { PostgresApiKeyRepository } from "./persistence/postgres-api-key-repository";
export { PostgresAuditLog } from "./persistence/postgres-audit-log";
export { PostgresDeviceRepository } from "./persistence/postgres-device-repository";
export { PostgresEventStore } from "./persistence/postgres-event-store";
export {
  PostgresCapabilityDefinitionRepository,
  PostgresMembershipRepository,
  PostgresNotificationHistoryRepository,
  PostgresPluginRepository,
  PostgresRoleRepository,
  PostgresSettingsRepository,
  PostgresSpaceRepository,
  PostgresWorkspaceRepository,
} from "./persistence/postgres-platform-repositories";
export {
  generateAgentToken,
  generateApiKey,
  hashToken,
  isAgentToken,
  isApiKey,
} from "./security/token-crypto";
export { InMemoryScheduler } from "./services/in-memory-scheduler";
export {
  TimerHealthMonitor,
  type TimerHealthMonitorOptions,
} from "./services/timer-health-monitor";
