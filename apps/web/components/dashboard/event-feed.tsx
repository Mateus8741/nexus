import type { DeviceEvent, DeviceEventType } from "@nexus/domain";
import { cn } from "@nexus/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, PlugZap, RefreshCw, Unplug, Zap } from "lucide-react";

import { formatRelativeTime } from "@/lib/format-relative-time";

const EVENT_ICON: Record<DeviceEventType, LucideIcon> = {
  "device.connected": PlugZap,
  "device.disconnected": Unplug,
  "device.state-changed": RefreshCw,
  "device.action-executed": Zap,
  "device.error": AlertTriangle,
};

const EVENT_ICON_STYLE: Record<DeviceEventType, string> = {
  "device.connected": "text-emerald-500",
  "device.disconnected": "text-muted-foreground",
  "device.state-changed": "text-blue-500",
  "device.action-executed": "text-violet-500",
  "device.error": "text-red-500",
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

export function EventFeed({ events, deviceName }: EventFeedProps) {
  return (
    <ul className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {events.map((event) => {
        const Icon = EVENT_ICON[event.type];
        return (
          <li
            key={`${event.deviceId}-${event.type}-${event.occurredAt.getTime()}`}
            className="flex items-start gap-2.5 text-sm"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", EVENT_ICON_STYLE[event.type])} />
            <div className="min-w-0">
              <p className="text-foreground">
                <span className="font-medium">{deviceName(event.deviceId)}</span>{" "}
                <span className="text-muted-foreground">{describeEvent(event)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(event.occurredAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
