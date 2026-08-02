import type {
  CapabilityDefinition,
  CapabilityRegistry,
  Device,
  DeviceConnectionStatus,
} from "@nexus/domain";
import { resolveDeviceActions } from "@nexus/domain";

import { cn } from "@nexus/ui/lib/utils";

import { DeviceActionButtons } from "@/components/dashboard/device-action-buttons";
import { formatRelativeTime } from "@/lib/format-relative-time";

const STATUS_DOT: Record<DeviceConnectionStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  unknown: "bg-zinc-500",
};

const STATUS_LABEL: Record<DeviceConnectionStatus, string> = {
  online: "online",
  offline: "offline",
  unknown: "desconhecido",
};

interface DeviceTableProps {
  devices: Device[];
  providerName: (device: Device) => string;
  capabilities: CapabilityDefinition[];
}

/**
 * Adapta o array de CapabilityDefinition (vindo de GET /capabilities) para
 * o formato que `resolveDeviceActions` espera — ele só chama `.get(key)`,
 * então um lookup simples baseado em Map já satisfaz a interface
 * CapabilityRegistry sem precisar de uma implementação completa aqui.
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

export function DeviceTable({ devices, providerName, capabilities }: DeviceTableProps) {
  const capabilityRegistry = buildCapabilityRegistry(capabilities);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Dispositivo</th>
            <th className="px-4 py-2 font-medium">Integração</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Última leitura</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {devices.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                Nenhum dispositivo conectado ainda.
              </td>
            </tr>
          ) : (
            devices.map((device) => {
              const actions = resolveDeviceActions(device, capabilityRegistry);

              return (
                <tr
                  key={device.id}
                  className="border-b border-border last:border-0 hover:bg-accent/50"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{device.name}</div>
                    <div className="text-xs text-muted-foreground">{device.kind}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{providerName(device)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn("size-1.5 rounded-full", STATUS_DOT[device.state.status])}
                      />
                      <span className="text-muted-foreground">
                        {STATUS_LABEL[device.state.status]}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatRelativeTime(device.state.observedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <DeviceActionButtons deviceId={device.id} actions={actions} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
