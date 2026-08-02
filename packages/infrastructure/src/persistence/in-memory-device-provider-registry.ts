import type { DeviceProvider, DeviceProviderRegistry } from "@nexus/domain";

/**
 * Implementação concreta, em memória, de DeviceProviderRegistry
 * (@nexus/domain). O composition root (apps/plugin-host) registra cada
 * provider aqui na hora de montar o plugin correspondente — é isso que
 * permite o Action Dispatcher (ExecuteDeviceActionUseCase, em
 * @nexus/application) achar o provider certo sem nunca conhecer seu nome.
 */
export class InMemoryDeviceProviderRegistry implements DeviceProviderRegistry {
  private readonly providers = new Map<string, DeviceProvider>();

  register(provider: DeviceProvider): void {
    this.providers.set(provider.descriptor.id, provider);
  }

  get(providerId: string): DeviceProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): readonly DeviceProvider[] {
    return Array.from(this.providers.values());
  }
}
