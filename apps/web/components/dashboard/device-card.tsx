import type { CapabilityRegistry, Device, DeviceConnectionStatus } from "@nexus/domain";
import { resolveDeviceActions } from "@nexus/domain";
import { Badge } from "@nexus/ui/components/badge";
import { cn } from "@nexus/ui/lib/utils";

import { DeviceControls } from "@/components/dashboard/device-controls";
import { DeviceIcon } from "@/components/dashboard/device-icon";
import { formatRelativeTime } from "@/lib/format-relative-time";

const STATUS_VARIANT: Record<DeviceConnectionStatus, "success" | "destructive" | "default"> = {
  online: "success",
  offline: "destructive",
  unknown: "default",
};

const STATUS_LABEL: Record<DeviceConnectionStatus, string> = {
  online: "Online",
  offline: "Offline",
  unknown: "Desconhecido",
};

interface DeviceCardProps {
  readonly device: Device;
  readonly providerName: string;
  readonly capabilityRegistry: CapabilityRegistry;
}

/**
 * Card por dispositivo — pensado pra alguém que NÃO conhece o Nexus
 * entender de cara: nome, ícone por tipo, status, e os controles do dia a
 * dia (ligar/desligar, brilho, temperatura...) logo visíveis. Qualquer
 * coisa mais técnica (comando remoto, data point cru, atributos brutos)
 * fica atrás do "Avançado" dentro de DeviceControls — nunca escondida de
 * quem precisa, só fora do caminho de quem não precisa.
 */
export function DeviceCard({ device, providerName, capabilityRegistry }: DeviceCardProps) {
  const actions = resolveDeviceActions(device, capabilityRegistry);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
              device.state.status === "online" && "text-foreground",
            )}
          >
            <DeviceIcon kind={device.kind} />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{device.name}</div>
            <div className="text-xs text-muted-foreground">{providerName}</div>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[device.state.status]}>{STATUS_LABEL[device.state.status]}</Badge>
      </div>

      <DeviceControls deviceId={device.id} actions={actions} attributes={device.state.attributes} />

      <div className="text-[0.7rem] text-muted-foreground">
        Última leitura: {formatRelativeTime(device.state.observedAt)}
      </div>
    </div>
  );
}
