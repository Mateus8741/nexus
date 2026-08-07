import { cn } from "@nexus/ui/lib/utils";
import { AirVent, Camera, Cpu, Lightbulb, Monitor, Radio, ToggleLeft } from "lucide-react";

/**
 * Ícone por `device.kind` — só decoração, nunca usado para decidir que
 * ações um dispositivo tem (isso vem de `device.capabilities`, ver
 * @nexus/domain). Kinds desconhecidos caem no ícone genérico (Cpu): um
 * plugin novo com um `kind` novo não quebra nada, só fica menos bonito até
 * alguém adicionar um mapeamento aqui.
 */
const KIND_ICON: Record<string, typeof Cpu> = {
  light: Lightbulb,
  switch: ToggleLeft,
  climate: AirVent,
  computer: Monitor,
  sensor: Radio,
  camera: Camera,
};

interface DeviceIconProps {
  kind: string;
  className?: string;
}

export function DeviceIcon({ kind, className }: DeviceIconProps) {
  const Icon = KIND_ICON[kind] ?? Cpu;
  return <Icon className={cn("size-5", className)} />;
}
