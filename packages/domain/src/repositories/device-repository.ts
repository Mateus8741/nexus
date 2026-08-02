import type { Device } from "../entities/device";
import type { DeviceState } from "../value-objects/device-state";

/** Persistência de dispositivos (fonte de verdade). DeviceRegistry é projeção runtime. */
export interface DeviceRepository {
  upsert(device: Device & { workspaceId: string }): Promise<void>;
  get(deviceId: string): Promise<Device | undefined>;
  list(workspaceId?: string): Promise<readonly Device[]>;
  updateState(deviceId: string, state: DeviceState): Promise<void>;
  remove(deviceId: string): Promise<void>;
}
