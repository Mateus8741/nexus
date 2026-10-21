"use client";

import { cn } from "@nexus/ui/lib/utils";
import { Minus, Plus, Power, Snowflake } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { DeviceHandlers } from "@/components/dashboard/device-handlers";
import { Spotlight } from "@/components/motion/spotlight";
import {
  type DevicePatches,
  type DeviceView,
  findTemperatureControl,
  readRoomTemperature,
  readTargetTemperature,
} from "@/lib/devices/view";

interface ClimateTileProps extends Pick<DeviceHandlers, "onPower" | "onTarget"> {
  readonly view: DeviceView;
  readonly patches: DevicePatches;
  readonly spaceName?: string;
}

/** Ar-condicionado: −/+ de temperatura-alvo e botão de energia, como no widget de referência. */
export function ClimateTile({ view, patches, spaceName, onPower, onTarget }: ClimateTileProps) {
  const control = findTemperatureControl(view);
  const target = readTargetTemperature(view, patches);
  const room = readRoomTemperature(view);
  const { isOn, online, device } = view;
  const active = isOn && online;

  const adjust = (delta: number) => {
    if (!control || target === undefined) return;
    const next = Math.min(control.max, Math.max(control.min, target + delta * control.step));
    if (next !== target) onTarget(view, control.field, control.action.actionType, next);
  };

  return (
    <Spotlight
      layout
      className={cn(
        "col-span-full flex flex-wrap items-center gap-3 p-3.5",
        active && "glow-ring",
        !online && "opacity-55",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span
          className={cn(
            "relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-muted-foreground transition-colors duration-300",
            active &&
              "border-transparent bg-gradient-to-br from-sky-300 to-cyan-400 text-sky-950 shadow-[0_0_24px_-2px_oklch(0.8_0.12_220/0.7)]",
          )}
        >
          <Snowflake className={cn("size-5", active && "[animation:spin_9s_linear_infinite]")} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[0.95rem] font-medium leading-tight">{device.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {!online ? "Offline" : isOn ? "Ligado" : "Desligado"}
            {spaceName ? ` · ${spaceName}` : ""}
            {room !== undefined ? ` · Ambiente ${room.toFixed(1)}°` : ""}
          </div>
        </div>
      </div>

      {control && target !== undefined ? (
        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            disabled={!online}
            aria-label="Diminuir temperatura"
            onClick={() => adjust(-1)}
            className="rounded-lg p-2 text-muted-foreground outline-none hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <Minus className="size-4" />
          </motion.button>
          <div className="relative h-8 w-14 overflow-hidden text-center text-xl font-semibold tabular-nums">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={target}
                className={cn("absolute inset-0 leading-8", !isOn && "text-muted-foreground")}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              >
                {Math.round(target * 10) / 10}°
              </motion.span>
            </AnimatePresence>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            disabled={!online}
            aria-label="Aumentar temperatura"
            onClick={() => adjust(1)}
            className="rounded-lg p-2 text-muted-foreground outline-none hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <Plus className="size-4" />
          </motion.button>
        </div>
      ) : null}

      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        disabled={!online || !view.supportsPower}
        aria-pressed={isOn}
        aria-label={isOn ? "Desligar ar-condicionado" : "Ligar ar-condicionado"}
        onClick={() => onPower(view, !isOn)}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
          active &&
            "border-transparent bg-sky-400/90 text-sky-950 shadow-[0_0_20px_-2px_oklch(0.8_0.12_220/0.8)]",
        )}
      >
        <Power className="size-4" />
      </motion.button>
    </Spotlight>
  );
}
