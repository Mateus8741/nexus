import type { Device } from "@nexus/domain";

import { type DeviceStateDto, fromDeviceStateDto, toDeviceStateDto } from "./device-state-dto";

/** Device, mas JSON-safe — ver device-state-dto.ts. */
export interface DeviceDto {
  readonly id: string;
  readonly providerId: string;
  readonly externalId: string;
  readonly name: string;
  readonly kind: string;
  readonly spaceId?: string;
  readonly capabilities: Device["capabilities"];
  readonly metadata?: Device["metadata"];
  readonly state: DeviceStateDto;
}

export function toDeviceDto(device: Device): DeviceDto {
  return {
    id: device.id,
    providerId: device.providerId,
    externalId: device.externalId,
    name: device.name,
    kind: device.kind,
    spaceId: device.spaceId,
    capabilities: device.capabilities,
    metadata: device.metadata,
    state: toDeviceStateDto(device.state),
  };
}

export function fromDeviceDto(dto: DeviceDto): Device {
  return {
    id: dto.id,
    providerId: dto.providerId,
    externalId: dto.externalId,
    name: dto.name,
    kind: dto.kind,
    spaceId: dto.spaceId,
    capabilities: dto.capabilities,
    metadata: dto.metadata,
    state: fromDeviceStateDto(dto.state),
  };
}
