import { cn } from "@nexus/ui/lib/utils";
import { AirVent, Camera, Cpu, Laptop, Lightbulb, Monitor, Plug, Radio } from "lucide-react";

import type { DeviceCategory } from "@/lib/devices/view";

const CATEGORY_ICON: Record<DeviceCategory, typeof Cpu> = {
  light: Lightbulb,
  plug: Plug,
  climate: AirVent,
  computer: Monitor,
  sensor: Radio,
  camera: Camera,
  other: Cpu,
};

interface DeviceIconProps {
  category: DeviceCategory;
  /** `laptop` troca o ícone de computador (ex.: macOS). */
  laptop?: boolean;
  className?: string;
}

/** Ícone por categoria — só decoração (o que o dispositivo faz vem das capabilities). */
export function DeviceIcon({ category, laptop, className }: DeviceIconProps) {
  const Icon = category === "computer" && laptop ? Laptop : CATEGORY_ICON[category];
  return <Icon className={cn("size-5", className)} />;
}
