import type { DeviceView } from "@/lib/devices/view";

/** Callbacks que os tiles recebem do DashboardView (que é dono do estado otimista). */
export interface DeviceHandlers {
  readonly onPower: (view: DeviceView, on: boolean) => void;
  readonly onTarget: (view: DeviceView, field: string, actionType: string, value: number) => void;
  readonly onAction: (view: DeviceView, actionType: string) => void;
}
