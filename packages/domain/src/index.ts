/**
 * @nexus/domain — Camada de Domínio
 *
 * Contém as regras de negócio centrais do Nexus: entidades, objetos de valor,
 * interfaces de repositório (ports), registries e eventos de domínio.
 *
 * Regra de dependência: esta camada NÃO pode importar nada de
 * @nexus/application, @nexus/infrastructure, @nexus/plugins-sdk ou de
 * qualquer framework (Next.js, banco de dados, MQTT, etc). É o núcleo
 * estável em torno do qual as demais camadas giram.
 *
 * Primeiro conjunto de tipos reais: o sistema de Dispositivos (Device,
 * DeviceProvider, DeviceAction, DeviceState, DeviceEvent, DeviceRegistry).
 * Tudo aqui é abstração pura — interfaces e types, zero classes e zero
 * lógica em runtime. Nenhum adaptador concreto (Windows, Tuya, Docker, ou
 * qualquer outro) faz parte deste pacote.
 *
 * Segundo conjunto: os serviços centrais da plataforma (consolidação do
 * Core, ver ARCHITECTURE.md) — EventBus/SystemEvent (events/), Capability
 * System (capabilities/), DeviceProviderRegistry (registries/), AuditLog
 * (services/), NotificationChannel (notifications/) e Scheduler
 * (scheduling/). Mesma regra: só interfaces/types aqui, as implementações
 * concretas (InMemory*) vivem em @nexus/infrastructure, e a orquestração
 * (use-cases como ExecuteDeviceActionUseCase/HealthService/
 * NotificationCenter) vive em @nexus/application.
 */

export * from "./capabilities";
export * from "./entities";
export * from "./events";
export * from "./notifications";
export * from "./registries";
export * from "./repositories";
export * from "./scheduling";
export * from "./services";
export * from "./value-objects";
