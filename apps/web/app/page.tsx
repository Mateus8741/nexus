import type { Device } from "@nexus/domain";
import { Activity, Boxes, Cpu, Puzzle } from "lucide-react";

import { ActivityChart } from "@/components/dashboard/activity-chart";
import { DeviceGrid } from "@/components/dashboard/device-grid";
import { EventFeed } from "@/components/dashboard/event-feed";
import { ProviderOverview } from "@/components/dashboard/provider-overview";
import { StatCard } from "@/components/dashboard/stat-card";
import { mockActivitySeries } from "@/lib/mocks/activity-series";
import {
  fetchCapabilities,
  fetchDevices,
  fetchEvents,
  fetchPlugins,
  fetchProviders,
  type ProviderSummaryDto,
} from "@/lib/nexus-client";

function providerNameFactory(providers: ProviderSummaryDto[]) {
  return (device: Device): string =>
    providers.find((provider) => provider.id === device.providerId)?.name ?? "Sem integração";
}

function deviceNameFactory(devices: Device[]) {
  return (deviceId: string): string =>
    devices.find((device) => device.id === deviceId)?.name ?? deviceId;
}

/**
 * Dashboard — agora consumindo dados reais de apps/plugin-host (devices,
 * events, plugins, providers). Único mock que sobra é o gráfico de
 * atividade (mockActivitySeries): construir um pipeline de métricas
 * históricas de verdade é escopo futuro, não desta etapa.
 *
 * Server Component assíncrono: o App Router do Next.js suporta isso
 * nativamente, sem config extra. Se o plugin-host não estiver rodando,
 * lib/nexus-client.ts já devolve arrays vazios (nunca lança) — por isso a
 * página nunca quebra, só mostra "nenhum dado ainda".
 */
export default async function Home() {
  const [devices, events, plugins, providers, capabilities] = await Promise.all([
    fetchDevices(),
    fetchEvents(),
    fetchPlugins(),
    fetchProviders(),
    fetchCapabilities(),
  ]);

  const onlineDevices = devices.filter((device) => device.state.status === "online").length;
  const providerName = providerNameFactory(providers);
  const deviceName = deviceNameFactory(devices);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral com dados reais do plugin-host — exceto o gráfico de atividade, que continua
          mockado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Dispositivos online"
          value={`${onlineDevices}/${devices.length}`}
          icon={Cpu}
          hint="dados reais"
        />
        <StatCard
          label="Integrações"
          value={String(providers.length)}
          icon={Boxes}
          hint="dados reais"
        />
        <StatCard
          label="Automações ativas"
          value="0"
          icon={Activity}
          hint="sistema ainda não implementado"
        />
        <StatCard
          label="Plugins instalados"
          value={String(plugins.length)}
          icon={Puzzle}
          hint="dados reais"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Atividade (24h)</h2>
            <span className="text-xs text-muted-foreground">eventos por hora · mock</span>
          </div>
          <ActivityChart data={mockActivitySeries} />
        </div>
        <ProviderOverview providers={providers} devices={devices} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Dispositivos</h2>
        <DeviceGrid devices={devices} providerName={providerName} capabilities={capabilities} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground">Atividade recente</h2>
        <EventFeed events={events} deviceName={deviceName} />
      </div>
    </div>
  );
}
