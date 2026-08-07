import type { CapabilityDefinition, CapabilityRegistry, Device } from "@nexus/domain";

import { DeviceCard } from "@/components/dashboard/device-card";

interface DeviceGridProps {
  readonly devices: Device[];
  readonly providerName: (device: Device) => string;
  readonly capabilities: CapabilityDefinition[];
}

/**
 * Adapta o array de CapabilityDefinition (vindo de GET /capabilities) para
 * o formato que `resolveDeviceActions` espera — só um lookup por Map, sem
 * precisar de uma implementação completa de CapabilityRegistry aqui.
 */
function buildCapabilityRegistry(capabilities: CapabilityDefinition[]): CapabilityRegistry {
  const byKey = new Map(capabilities.map((capability) => [capability.key, capability]));
  return {
    register: () => {
      throw new Error("buildCapabilityRegistry: registry somente leitura no client da Web.");
    },
    get: (key) => byKey.get(key),
    list: () => capabilities,
  };
}

export function DeviceGrid({ devices, providerName, capabilities }: DeviceGridProps) {
  const capabilityRegistry = buildCapabilityRegistry(capabilities);

  if (devices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum dispositivo conectado ainda.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          providerName={providerName(device)}
          capabilityRegistry={capabilityRegistry}
        />
      ))}
    </div>
  );
}
