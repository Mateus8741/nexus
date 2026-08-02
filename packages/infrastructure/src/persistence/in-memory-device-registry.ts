import type { Device, DeviceEvent, DeviceRegistry, DeviceState } from "@nexus/domain";

type DeviceRegistryListener = (event: DeviceEvent) => void;

/**
 * Implementação concreta, em memória, de DeviceRegistry (@nexus/domain).
 * Agrega dispositivos de um ou mais DeviceProvider — quem faz essa
 * agregação (ligar um provider a este registry) é @nexus/application
 * (AttachDeviceProviderUseCase), não este registry.
 *
 * "Em memória" é uma escolha explícita desta etapa: nada aqui é persistido
 * em disco/banco — reiniciar apps/plugin-host esquece todo o estado
 * conhecido (os devices reaparecem assim que os providers reconectarem e
 * reenviarem `register`). Trocar por uma versão persistida no futuro não
 * deve exigir mudar nenhum consumidor, já que eles só conhecem a interface
 * DeviceRegistry.
 */
export class InMemoryDeviceRegistry implements DeviceRegistry {
  private readonly devices = new Map<string, Device>();
  private readonly listeners = new Set<DeviceRegistryListener>();

  register(device: Device): void {
    this.devices.set(device.id, device);
  }

  unregister(deviceId: string): void {
    this.devices.delete(deviceId);
  }

  get(deviceId: string): Device | undefined {
    return this.devices.get(deviceId);
  }

  has(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }

  list(): readonly Device[] {
    return Array.from(this.devices.values());
  }

  listByProvider(providerId: string): readonly Device[] {
    return this.list().filter((device) => device.providerId === providerId);
  }

  listByKind(kind: string): readonly Device[] {
    return this.list().filter((device) => device.kind === kind);
  }

  updateState(deviceId: string, state: DeviceState): void {
    const device = this.devices.get(deviceId);
    if (!device) return;
    this.devices.set(deviceId, { ...device, state });
  }

  /**
   * O registry só repassa eventos — quem os produz é o DeviceProvider
   * conectado a ele (via AttachDeviceProviderUseCase). Isso mantém este
   * registry livre de conhecer qualquer detalhe de Windows/Docker/etc.
   */
  subscribe(listener: DeviceRegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event: DeviceEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
