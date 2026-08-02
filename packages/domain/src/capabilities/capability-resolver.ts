import type { Device } from "../entities/device";
import type { CapabilityRegistry } from "./capability-registry";

/**
 * Uma ação concreta que a UI pode oferecer para um Device específico —
 * já resolvida contra o CapabilityRegistry (com label pronta para exibir).
 */
export interface ResolvedDeviceAction {
  readonly capabilityKey: string;
  readonly actionType: string;
  readonly label: string;
  readonly payloadSchema?: Readonly<Record<string, "string" | "number" | "boolean">>;
}

/**
 * `device.hasCapability("restart")` do PROJECT.md, como função pura — o
 * Core não usa classes para Device (ver entities/device.ts), então isto é
 * o equivalente funcional. Nunca verifica `device.kind` nem qualquer coisa
 * específica de fabricante: só olha a lista de capabilities que o próprio
 * DeviceProvider declarou para este dispositivo.
 */
export function deviceHasCapability(device: Device, capabilityKey: string): boolean {
  return device.capabilities.some((capability) => capability.key === capabilityKey);
}

/**
 * Resolve todas as ações que a UI deveria oferecer para um Device,
 * combinando o que ELE declara suportar (`device.capabilities`) com o que
 * cada Capability SIGNIFICA (`CapabilityRegistry`). Se uma capability
 * declarada pelo device não tiver definição registrada (plugin não
 * registrou, ou ainda não subiu), a ação ainda aparece — só sem label
 * bonita (cai no próprio nome da action).
 *
 * É isto que a UI chama em vez de qualquer `if (device.kind === "...")`.
 */
export function resolveDeviceActions(
  device: Device,
  registry: CapabilityRegistry,
): readonly ResolvedDeviceAction[] {
  const resolved: ResolvedDeviceAction[] = [];

  for (const capability of device.capabilities) {
    const definition = registry.get(capability.key);
    const actionTypes = capability.actions ?? [];

    for (const actionType of actionTypes) {
      const schema = definition?.actions?.find((action) => action.type === actionType);
      resolved.push({
        capabilityKey: capability.key,
        actionType,
        label: schema?.label ?? actionType,
        payloadSchema: schema?.payloadSchema,
      });
    }
  }

  return resolved;
}
