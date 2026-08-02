import type {
  Device,
  DeviceEvent,
  DeviceRegistry,
  DeviceRepository,
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
 * DeviceRegistry com projeção em memória + write-through para Postgres.
 * Fonte de verdade: DeviceRepository. Cache aquecido no bootstrap via hydrate().
 */
export class PersistingDeviceRegistry implements DeviceRegistry {
  private readonly devices = new Map<string, Device>();

  constructor(
    private readonly eventBus: EventBus<SystemEvent>,
    private readonly repository: DeviceRepository,
    private readonly workspaceId: string,
  ) {}

  async hydrate(): Promise<void> {
    const stored = await this.repository.list(this.workspaceId);
    for (const device of stored) {
      this.devices.set(device.id, device);
    }
  }

  register(device: Device): void {
    this.devices.set(device.id, device);
    void this.repository.upsert({ ...device, workspaceId: this.workspaceId });
  }

  unregister(deviceId: string): void {
    this.devices.delete(deviceId);
    void this.repository.remove(deviceId);
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
    void this.repository.updateState(deviceId, state);
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
