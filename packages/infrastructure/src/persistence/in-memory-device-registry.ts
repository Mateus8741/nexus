import type {
  Device,
  DeviceEvent,
  DeviceRegistry,
  DeviceState,
  EventBus,
  SystemEvent,
} from "@nexus/domain";

const DEVICE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "device.connected",
  "device.disconnected",
  "device.state-changed",
  "device.action-executed",
  "device.error",
]);

function isDeviceEvent(event: SystemEvent): event is DeviceEvent {
  return DEVICE_EVENT_TYPES.has(event.type);
}

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
 *
 * `notify`/`subscribe` delegam para um EventBus injetado em vez de manter
 * uma lista de ouvintes própria (ver ARCHITECTURE.md, "Event Bus") — isso
 * é o que garante que eventos de dispositivo passem pelo MESMO barramento
 * usado por eventos de plugin/capability, em vez de um canal paralelo.
 * `subscribe()` filtra o stream do bus para só repassar DeviceEvent aos
 * assinantes (o bus também carrega PluginLoadedEvent/etc., que não fazem
 * sentido para quem assina especificamente este registry).
 */
export class InMemoryDeviceRegistry implements DeviceRegistry {
  private readonly devices = new Map<string, Device>();

  constructor(private readonly eventBus: EventBus<SystemEvent>) {}

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

  subscribe(listener: (event: DeviceEvent) => void): () => void {
    return this.eventBus.subscribe((event) => {
      if (isDeviceEvent(event)) listener(event);
    });
  }

  notify(event: DeviceEvent): void {
    this.eventBus.publish(event);
  }
}
