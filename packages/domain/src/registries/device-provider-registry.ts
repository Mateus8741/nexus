import type { DeviceProvider } from "../repositories/device-provider";

/**
 * DeviceProviderRegistry — mapeia `providerId → DeviceProvider`. Existe
 * para que o Action Dispatcher (ExecuteDeviceActionUseCase, em
 * @nexus/application) consiga achar automaticamente qual provider executa
 * uma ação, sem o Core precisar conhecer nenhum provider específico por
 * nome (ver ARCHITECTURE.md, "Action Dispatcher").
 *
 * Implementação concreta: InMemoryDeviceProviderRegistry, em
 * @nexus/infrastructure.
 */
export interface DeviceProviderRegistry {
  register(provider: DeviceProvider): void;
  get(providerId: string): DeviceProvider | undefined;
  list(): readonly DeviceProvider[];
}
