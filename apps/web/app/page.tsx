import type { Device } from "@nexus/domain";
import { Activity, Boxes, Cpu, Puzzle } from "lucide-react";

import { ActivityChart } from "@/components/dashboard/activity-chart";
import { DeviceTable } from "@/components/dashboard/device-table";
import { EnvironmentOverview } from "@/components/dashboard/environment-overview";
import { EventFeed } from "@/components/dashboard/event-feed";
import { StatCard } from "@/components/dashboard/stat-card";
import { mockActivitySeries } from "@/lib/mocks/activity-series";
import { mockDevices } from "@/lib/mocks/devices";
import { mockEnvironments } from "@/lib/mocks/environments";
import { mockEvents } from "@/lib/mocks/events";

function environmentName(device: Device): string {
  return (
    mockEnvironments.find((environment) => environment.id === device.spaceId)?.name ??
    "Sem ambiente"
  );
}

function deviceName(deviceId: string): string {
  return mockDevices.find((device) => device.id === deviceId)?.name ?? deviceId;
}

/**
 * Dashboard — só para validar a interface visual. Todos os dados vêm de
 * apps/web/lib/mocks/*; nenhuma API real está conectada e nenhuma lógica de
 * negócio roda aqui (a página só formata e agrupa os mocks para exibição).
 */
export default function Home() {
  const onlineDevices = mockDevices.filter((device) => device.state.status === "online").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral com dados mockados, só para validar a interface — nenhuma API real está
          conectada ainda.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Dispositivos online"
          value={`${onlineDevices}/${mockDevices.length}`}
          icon={Cpu}
          hint="dados mockados"
        />
        <StatCard
          label="Ambientes"
          value={String(mockEnvironments.length)}
          icon={Boxes}
          hint="dados mockados"
        />
        <StatCard
          label="Automações ativas"
          value="0"
          icon={Activity}
          hint="sistema ainda não implementado"
        />
        <StatCard
          label="Plugins instalados"
          value="0"
          icon={Puzzle}
          hint="nenhum plugin real ainda"
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
        <EnvironmentOverview environments={mockEnvironments} devices={mockDevices} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-foreground">Dispositivos</h2>
          <DeviceTable devices={mockDevices} environmentName={environmentName} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium text-foreground">Atividade recente</h2>
          <EventFeed events={mockEvents} deviceName={deviceName} />
        </div>
      </div>
    </div>
  );
}
