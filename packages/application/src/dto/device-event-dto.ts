import type { DeviceAction, DeviceActionResult, DeviceEvent } from "@nexus/domain";

import { type DeviceStateDto, fromDeviceStateDto, toDeviceStateDto } from "./device-state-dto";

interface DeviceEventDtoBase {
  readonly deviceId: string;
  readonly occurredAt: string;
}

export interface DeviceConnectedEventDto extends DeviceEventDtoBase {
  readonly type: "device.connected";
}

export interface DeviceDisconnectedEventDto extends DeviceEventDtoBase {
  readonly type: "device.disconnected";
  readonly reason?: string;
}

export interface DeviceStateChangedEventDto extends DeviceEventDtoBase {
  readonly type: "device.state-changed";
  readonly previousState: DeviceStateDto | null;
  readonly currentState: DeviceStateDto;
}

export interface DeviceActionExecutedEventDto extends DeviceEventDtoBase {
  readonly type: "device.action-executed";
  readonly action: DeviceAction;
  readonly result: DeviceActionResult;
}

export interface DeviceErrorEventDto extends DeviceEventDtoBase {
  readonly type: "device.error";
  readonly message: string;
}

/** DeviceEvent, mas JSON-safe — ver device-state-dto.ts. `previousState` vira `null` (não `undefined`) porque `JSON.stringify` descarta chaves `undefined`, e o cliente precisa saber que a chave existe mas não tinha valor. */
export type DeviceEventDto =
  | DeviceConnectedEventDto
  | DeviceDisconnectedEventDto
  | DeviceStateChangedEventDto
  | DeviceActionExecutedEventDto
  | DeviceErrorEventDto;

export function toDeviceEventDto(event: DeviceEvent): DeviceEventDto {
  const base = { deviceId: event.deviceId, occurredAt: event.occurredAt.toISOString() };

  switch (event.type) {
    case "device.connected":
      return { type: event.type, ...base };
    case "device.disconnected":
      return { type: event.type, ...base, reason: event.reason };
    case "device.state-changed":
      return {
        type: event.type,
        ...base,
        previousState: event.previousState ? toDeviceStateDto(event.previousState) : null,
        currentState: toDeviceStateDto(event.currentState),
      };
    case "device.action-executed":
      return { type: event.type, ...base, action: event.action, result: event.result };
    case "device.error":
      return { type: event.type, ...base, message: event.message };
    default: {
      const exhaustiveCheck: never = event;
      return exhaustiveCheck;
    }
  }
}

export function fromDeviceEventDto(dto: DeviceEventDto): DeviceEvent {
  const base = { deviceId: dto.deviceId, occurredAt: new Date(dto.occurredAt) };

  switch (dto.type) {
    case "device.connected":
      return { type: dto.type, ...base };
    case "device.disconnected":
      return { type: dto.type, ...base, reason: dto.reason };
    case "device.state-changed":
      return {
        type: dto.type,
        ...base,
        previousState: dto.previousState ? fromDeviceStateDto(dto.previousState) : undefined,
        currentState: fromDeviceStateDto(dto.currentState),
      };
    case "device.action-executed":
      return { type: dto.type, ...base, action: dto.action, result: dto.result };
    case "device.error":
      return { type: dto.type, ...base, message: dto.message };
    default: {
      const exhaustiveCheck: never = dto;
      return exhaustiveCheck;
    }
  }
}
