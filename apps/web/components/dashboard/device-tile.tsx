"use client";

import { cn } from "@nexus/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { DeviceControls } from "@/components/dashboard/device-controls";
import type { DeviceHandlers } from "@/components/dashboard/device-handlers";
import { DeviceIcon } from "@/components/dashboard/device-icon";
import { Spotlight } from "@/components/motion/spotlight";
import type { DeviceView } from "@/lib/devices/view";

interface DeviceTileProps extends Pick<DeviceHandlers, "onPower"> {
  readonly view: DeviceView;
  readonly spaceName?: string;
}

/**
 * Tile de luz/tomada/genérico — clique liga/desliga com mola; o chevron abre
 * os controles completos (brilho, cor, comandos) vindos das capabilities.
 */
export function DeviceTile({ view, spaceName, onPower }: DeviceTileProps) {
  const [open, setOpen] = useState(false);
  const { device, online, supportsPower, isOn } = view;
  const interactive = supportsPower && online;
  const status = !online ? "Offline" : supportsPower ? (isOn ? "Ligado" : "Desligado") : "Online";

  return (
    <Spotlight
      layout
      className={cn(
        "flex flex-col overflow-hidden transition-[box-shadow,opacity] duration-300",
        isOn && online && supportsPower && "glow-ring",
        !online && "opacity-55",
      )}
    >
      <div className="flex items-center gap-1 pr-2">
        <motion.button
          type="button"
          layout="position"
          disabled={!interactive}
          aria-pressed={supportsPower ? isOn : undefined}
          aria-label={interactive ? `${isOn ? "Desligar" : "Ligar"} ${device.name}` : device.name}
          whileTap={interactive ? { scale: 0.97 } : undefined}
          onClick={() => onPower(view, !isOn)}
          className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
          <motion.span
            animate={{ scale: isOn && online ? 1.06 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-muted-foreground transition-colors duration-300",
              isOn &&
                online &&
                supportsPower &&
                "border-transparent bg-gradient-to-br from-amber-300 to-orange-400 text-amber-950 shadow-[0_0_24px_-2px_oklch(0.85_0.15_75/0.7)]",
            )}
          >
            <DeviceIcon category={view.category} />
          </motion.span>
          <span className="min-w-0">
            <span className="block truncate text-[0.95rem] font-medium leading-tight">
              {device.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {status}
              {spaceName ? ` · ${spaceName}` : ""}
            </span>
          </span>
        </motion.button>
        <button
          type="button"
          aria-label="Mais controles"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg p-1.5 text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn("size-4 transition-transform duration-300", open && "rotate-180")}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.07] p-4">
              <DeviceControls
                deviceId={device.id}
                actions={view.actions}
                attributes={device.state.attributes}
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
