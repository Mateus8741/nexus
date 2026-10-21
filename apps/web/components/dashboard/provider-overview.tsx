"use client";

import type { Device } from "@nexus/domain";
import { motion } from "motion/react";

import type { ProviderSummaryDto } from "@/lib/nexus-client";

interface ProviderOverviewProps {
  providers: ProviderSummaryDto[];
  devices: Device[];
}

/** Integrações (providers reais do plugin-host) com barra de disponibilidade animada. */
export function ProviderOverview({ providers, devices }: ProviderOverviewProps) {
  if (providers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma integração conectada ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {providers.map((provider) => {
        const providerDevices = devices.filter((device) => device.providerId === provider.id);
        const online = providerDevices.filter((device) => device.state.status === "online").length;
        const ratio = providerDevices.length === 0 ? 0 : online / providerDevices.length;
        return (
          <li key={provider.id}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">{provider.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {online}/{providerDevices.length} online
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-glow to-glow-2"
                initial={{ width: 0 }}
                animate={{ width: `${ratio * 100}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.3 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
