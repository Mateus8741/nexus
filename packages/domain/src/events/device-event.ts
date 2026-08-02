import type { DeviceAction, DeviceActionResult } from "../value-objects/device-action";
import type { DeviceState } from "../value-objects/device-state";

interface DeviceEventBase {
  readonly deviceId: string;
  readonly occurredAt: Date;
  readonly workspaceId?: string;
}

export interface DeviceConnectedEvent extends DeviceEventBase {
  readonly type: "device.connected";
}

export interface DeviceDisconnectedEvent extends DeviceEventBase {
  readonly type: "device.disconnected";
  readonly reason?: string;
}

export interface DeviceStateChangedEvent extends DeviceEventBase {
  readonly type: "device.state-changed";
  /** `undefined` quando é a primeira observação conhecida do dispositivo. */
  readonly previousState: DeviceState | undefined;
  readonly currentState: DeviceState;
}

export interface DeviceActionExecutedEvent extends DeviceEventBase {
  readonly type: "device.action-executed";
  readonly action: DeviceAction;
  readonly result: DeviceActionResult;
}

export interface DeviceErrorEvent extends DeviceEventBase {
  readonly type: "device.error";
  readonly message: string;
}

/**
 * DeviceEvent — união discriminada de tudo que pode acontecer com um
 * dispositivo. Emitido por um DeviceProvider e observado via
 * DeviceRegistry.subscribe()/DeviceProvider.subscribe() — este tipo não
 * assume qual dos dois é a fonte.
 */
export type DeviceEvent =
  | DeviceConnectedEvent
  | DeviceDisconnectedEvent
  | DeviceStateChangedEvent
  | DeviceActionExecutedEvent
  | DeviceErrorEvent;

export type DeviceEventType = DeviceEvent["type"];
