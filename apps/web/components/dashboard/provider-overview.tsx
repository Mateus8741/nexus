import type { Device } from "@nexus/domain";

import type { ProviderSummaryDto } from "@/lib/nexus-client";

interface ProviderOverviewProps {
  providers: ProviderSummaryDto[];
  devices: Device[];
}

/**
 * Antes chamado de "Ambientes" (environment-overview.tsx), agrupando por um
 * lookup mockado de Espaço/Ambiente — entidade que @nexus/domain ainda não
 * tem. Renomeado para "Integrações": agora agrupa por provider real
 * (`GET /providers` do plugin-host), que já existe de verdade no sistema.
 */
export function ProviderOverview({ providers, devices }: ProviderOverviewProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">Integrações</h2>
      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma integração conectada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {providers.map((provider) => {
            const providerDevices = devices.filter((device) => device.providerId === provider.id);
            const onlineCount = providerDevices.filter(
              (device) => device.state.status === "online",
            ).length;

            return (
              <li key={provider.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{provider.name}</span>
                <span className="text-xs text-muted-foreground">
                  {onlineCount}/{providerDevices.length} online
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
