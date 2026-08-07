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
  // Defensivo: `observedAt` deveria sempre ser um `Date` em memória, mas um
  // Device hidratado direto de uma fonte JSON (ex.: linha crua do Postgres,
  // antes de passar por rowToState — ver postgres-device-repository.ts)
  // pode chegar aqui com uma string ISO. `new Date(Date)` é um no-op seguro.
  const observedAt = state.observedAt instanceof Date ? state.observedAt : new Date(state.observedAt);
  return {
    status: state.status,
    attributes: state.attributes,
    observedAt: observedAt.toISOString(),
  };
}

export function fromDeviceStateDto(dto: DeviceStateDto): DeviceState {
  return {
    status: dto.status,
    attributes: dto.attributes,
    observedAt: new Date(dto.observedAt),
  };
}
