"use client";

import { cn } from "@nexus/ui/lib/utils";
import { Lock, Power, RotateCw, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { DeviceControls } from "@/components/dashboard/device-controls";
import type { DeviceHandlers } from "@/components/dashboard/device-handlers";
import { DeviceIcon } from "@/components/dashboard/device-icon";
import { Spotlight } from "@/components/motion/spotlight";
import { type DeviceView, findAction, readNumber } from "@/lib/devices/view";

interface ComputerTileProps extends Pick<DeviceHandlers, "onAction"> {
  readonly view: DeviceView;
  readonly spaceName?: string;
}

function Meter({ label, value }: { label: string; value?: number }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const hot = pct >= 85;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value === undefined ? "—" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn(
            "h-full rounded-full bg-gradient-to-r from-glow to-glow-2",
            hot && "from-amber-400 to-red-500",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

function formatUptime(seconds?: number): string | undefined {
  if (seconds === undefined) return undefined;
  const hours = Math.floor(seconds / 3600);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`;
}

/** Botão de ação do sistema; shutdown/restart pedem uma segunda confirmação. */
function SystemButton({
  label,
  icon: Icon,
  danger,
  onConfirm,
}: {
  label: string;
  icon: typeof Power;
  danger?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      onClick={() => {
        if (danger && !armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        armed && "border-destructive/60 bg-destructive/20 text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      {armed ? "Confirmar?" : label}
    </motion.button>
  );
}

/** PC/Mac/servidor monitorado pelo Nexus Desktop: métricas ao vivo + ações de sistema. */
export function ComputerTile({ view, spaceName, onAction }: ComputerTileProps) {
  const [open, setOpen] = useState(false);
  const { device, online } = view;
  const attrs = device.state.attributes;
  const os = typeof attrs.operatingSystemName === "string" ? attrs.operatingSystemName : undefined;
  const uptime = formatUptime(readNumber(attrs, ["uptimeSeconds"]));
  const isMac = os?.toLowerCase().includes("mac") ?? false;
  const lock = findAction(view, "lock");
  const restart = findAction(view, "restart");
  const shutdown = findAction(view, "shutdown");
  const hasMore =
    view.actions.some((a) => a.actionType === "executeCommand") ||
    view.actions.some((a) => a.advanced);

  return (
    <Spotlight layout className={cn("flex flex-col overflow-hidden p-4", !online && "opacity-55")}>
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-muted-foreground",
            online &&
              "border-transparent bg-gradient-to-br from-glow to-glow-2 text-background shadow-[0_0_24px_-2px_color-mix(in_oklch,var(--glow)_70%,transparent)]",
          )}
        >
          <DeviceIcon category="computer" laptop={isMac} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.95rem] font-medium leading-tight">{device.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span
              className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-muted-foreground")}
            />
            {online ? "Online" : "Offline"}
            {os ? ` · ${os}` : ""}
            {spaceName ? ` · ${spaceName}` : ""}
          </div>
        </div>
        {uptime && online && (
          <span className="text-[0.7rem] text-muted-foreground">⏱ {uptime}</span>
        )}
      </div>

      {online && (
        <div className="mt-4 flex gap-4">
          <Meter label="CPU" value={readNumber(attrs, ["cpuUsagePercent", "cpu_usage"])} />
          <Meter label="RAM" value={readNumber(attrs, ["ramUsagePercent", "memory_usage"])} />
          <Meter label="Disco" value={readNumber(attrs, ["diskUsagePercent"])} />
        </div>
      )}

      {online && (lock || restart || shutdown || hasMore) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {lock && (
            <SystemButton
              label="Bloquear"
              icon={Lock}
              onConfirm={() => onAction(view, lock.actionType)}
            />
          )}
          {restart && (
            <SystemButton
              label="Reiniciar"
              icon={RotateCw}
              danger
              onConfirm={() => onAction(view, restart.actionType)}
            />
          )}
          {shutdown && (
            <SystemButton
              label="Desligar"
              icon={Power}
              danger
              onConfirm={() => onAction(view, shutdown.actionType)}
            />
          )}
          {hasMore && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SlidersHorizontal className="size-3.5" />
              Avançado
            </button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-white/[0.07] pt-3">
              <DeviceControls
                deviceId={device.id}
                actions={view.actions}
                attributes={attrs}
                hidePower
                defaultOpen
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Spotlight>
  );
}
