import type { DeviceState } from "@nexus/domain";

/**
 * DeviceStateDto — o mesmo DeviceState, mas JSON-safe (`observedAt` como
 * string ISO em vez de `Date`). Usado nas fronteiras HTTP (ex.:
 * apps/plugin-host expondo o DeviceRegistry, apps/web consumindo).
 */
export interface DeviceStateDto {
  readonly status: DeviceState["status"];
  readonly attributes: DeviceState["attributes"];
  readonly observedAt: string;
}

export function toDeviceStateDto(state: DeviceState): DeviceStateDto {
  return {
    status: state.status,
    attributes: state.attributes,
    observedAt: state.observedAt.toISOString(),
  };
}

export function fromDeviceStateDto(dto: DeviceStateDto): DeviceState {
  return {
    status: dto.status,
    attributes: dto.attributes,
    observedAt: new Date(dto.observedAt),
  };
}
