import type { Device } from "@nexus/domain";

import type { MockEnvironment } from "@/lib/mocks/environments";

interface EnvironmentOverviewProps {
  environments: MockEnvironment[];
  devices: Device[];
}

export function EnvironmentOverview({ environments, devices }: EnvironmentOverviewProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">Ambientes</h2>
      <ul className="flex flex-col gap-3">
        {environments.map((environment) => {
          const environmentDevices = devices.filter((device) => device.spaceId === environment.id);
          const onlineCount = environmentDevices.filter(
            (device) => device.state.status === "online",
          ).length;

          return (
            <li key={environment.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{environment.name}</span>
              <span className="text-xs text-muted-foreground">
                {onlineCount}/{environmentDevices.length} online
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
