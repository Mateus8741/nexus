"use client";

import type { DeviceEvent, DeviceEventType } from "@nexus/domain";
import { cn } from "@nexus/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, PlugZap, RefreshCw, Unplug, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { formatRelativeTime } from "@/lib/format-relative-time";

const EVENT_ICON: Record<DeviceEventType, LucideIcon> = {
  "device.connected": PlugZap,
  "device.disconnected": Unplug,
  "device.state-changed": RefreshCw,
  "device.action-executed": Zap,
  "device.error": AlertTriangle,
};

const EVENT_TONE: Record<DeviceEventType, string> = {
  "device.connected": "bg-emerald-400/15 text-emerald-300",
  "device.disconnected": "bg-white/10 text-muted-foreground",
  "device.state-changed": "bg-sky-400/15 text-sky-300",
  "device.action-executed": "bg-violet-400/15 text-violet-300",
  "device.error": "bg-red-400/15 text-red-300",
};

function describeEvent(event: DeviceEvent): string {
  switch (event.type) {
    case "device.connected":
      return "conectou";
    case "device.disconnected":
      return event.reason ? `desconectou (${event.reason})` : "desconectou";
    case "device.state-changed":
      return "mudou de estado";
    case "device.action-executed":
      return `executou "${event.action.type}"`;
    case "device.error":
      return event.message;
    default: {
      const exhaustiveCheck: never = event;
      return exhaustiveCheck;
    }
  }
}

interface EventFeedProps {
  events: DeviceEvent[];
  deviceName: (deviceId: string) => string;
}

/** Linha do tempo de eventos — itens entram deslizando, um após o outro. */
export function EventFeed({ events, deviceName }: EventFeedProps) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <ul className="relative flex flex-col gap-1">
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 left-[1.05rem] w-px bg-gradient-to-b from-white/15 to-transparent"
      />
      <AnimatePresence initial>
        {events.map((event, index) => {
          const Icon = EVENT_ICON[event.type];
          return (
            <motion.li
              key={`${event.deviceId}-${event.type}-${event.occurredAt.getTime()}`}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.15 + index * 0.06,
                type: "spring",
                stiffness: 260,
                damping: 24,
              }}
              className="relative flex items-start gap-3 rounded-xl p-1.5 text-sm transition-colors hover:bg-white/[0.04]"
            >
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                  EVENT_TONE[event.type],
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p>
                  <span className="font-medium">{deviceName(event.deviceId)}</span>{" "}
                  <span className="text-muted-foreground">{describeEvent(event)}</span>
                </p>
                <p className="text-xs text-muted-foreground/80">
                  {formatRelativeTime(event.occurredAt)}
                </p>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
