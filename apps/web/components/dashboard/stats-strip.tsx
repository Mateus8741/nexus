"use client";

import type { LucideIcon } from "lucide-react";

import { CountUp } from "@/components/motion/count-up";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { Spotlight } from "@/components/motion/spotlight";

export interface Stat {
  readonly label: string;
  readonly value: number;
  readonly icon: LucideIcon;
  readonly hint?: string;
}

/** Faixa de métricas com count-up e entrada em cascata. */
export function StatsStrip({ stats }: { readonly stats: readonly Stat[] }) {
  return (
    <RevealGroup className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, hint }) => (
        <RevealItem key={label}>
          <Spotlight className="p-4" whileHover={{ y: -3 }}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">{label}</span>
              <Icon className="size-4" />
            </div>
            <CountUp
              value={value}
              className="mt-2 block text-3xl font-semibold tracking-tight tabular-nums"
            />
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </Spotlight>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
