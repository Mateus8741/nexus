"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import type { ActivityPoint } from "@/lib/mocks/activity-series";

interface ActivityChartProps {
  data: ActivityPoint[];
}

/** Gráfico client-side (recharts precisa do browser) com gradiente neon. */
export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-glow)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--color-glow-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="activityStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-glow)" />
              <stop offset="100%" stopColor="var(--color-glow-2)" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 6%)" strokeDasharray="3 6" />
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            interval={3}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "oklch(1 0 0 / 20%)", strokeDasharray: "4 4" }}
            contentStyle={{
              background: "oklch(0.2 0.04 262 / 90%)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 12,
              backdropFilter: "blur(12px)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-foreground)" }}
            itemStyle={{ color: "var(--color-foreground)" }}
          />
          <Area
            type="monotone"
            dataKey="events"
            name="eventos"
            stroke="url(#activityStroke)"
            strokeWidth={2.5}
            fill="url(#activityFill)"
            animationDuration={1400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
