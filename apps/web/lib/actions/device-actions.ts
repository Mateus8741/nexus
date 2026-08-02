"use server";

import {
  type DeviceActionInput,
  type DeviceActionOutcome,
  executeDeviceAction,
} from "@/lib/nexus-client";

/**
 * Server Action — a única forma pela qual um Client Component (os botões de
 * ação em components/dashboard/device-action-buttons.tsx) pode disparar uma
 * DeviceAction no plugin-host.
 *
 * `NEXUS_PLUGIN_HOST_URL` é uma env var server-only (não prefixada com
 * NEXT_PUBLIC_), então o fetch em si (lib/nexus-client.ts) só pode rodar no
 * servidor. Marcar este módulo com "use server" faz o Next.js gerar um
 * endpoint RPC para `runDeviceAction`, que o bundle do cliente chama sem
 * nunca ver a URL do plugin-host nem rodar o fetch no browser.
 */
export async function runDeviceAction(
  deviceId: string,
  action: DeviceActionInput,
): Promise<DeviceActionOutcome> {
  return executeDeviceAction(deviceId, action);
}
