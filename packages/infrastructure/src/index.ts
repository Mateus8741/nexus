/**
 * @nexus/infrastructure — Camada de Infraestrutura
 *
 * Implementações concretas dos ports definidos em @nexus/domain,
 * @nexus/application e @nexus/plugins-sdk: persistência, mensageria,
 * adaptadores para sistemas externos (Docker, Proxmox, Home Assistant,
 * MQTT, etc.) e carregamento de configuração.
 *
 * Regra de dependência: pode depender de @nexus/domain, @nexus/application
 * e @nexus/plugins-sdk. É a única camada autorizada a depender de
 * bibliotecas externas e detalhes de infraestrutura (drivers de banco,
 * SDKs de terceiros, protocolos de rede — ex.: a lib `ws`).
 *
 * Consumida por apps/plugin-host (composition root).
 */

export { ConsoleNotificationChannel } from "./adapters/console-notification-channel";
export { InMemoryEventBus } from "./messaging/in-memory-event-bus";
export {
  WebSocketAgentGateway,
  type WebSocketAgentGatewayOptions,
} from "./messaging/websocket-agent-gateway";
export { InMemoryAuditLog } from "./persistence/in-memory-audit-log";
export { InMemoryCapabilityRegistry } from "./persistence/in-memory-capability-registry";
export { InMemoryDeviceProviderRegistry } from "./persistence/in-memory-device-provider-registry";
export { InMemoryDeviceRegistry } from "./persistence/in-memory-device-registry";
export { InMemoryScheduler } from "./services/in-memory-scheduler";
export {
  TimerHealthMonitor,
  type TimerHealthMonitorOptions,
} from "./services/timer-health-monitor";
