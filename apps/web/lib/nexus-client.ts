import {
  type DeviceDto,
  type DeviceEventDto,
  fromDeviceDto,
  fromDeviceEventDto,
} from "@nexus/application";
import type { CapabilityDefinition, Device, DeviceEvent } from "@nexus/domain";

/**
 * Cliente HTTP para `apps/plugin-host` — o processo que de fato conversa com
 * providers/agents e mantém o DeviceRegistry vivo. `apps/web` nunca acessa um
 * DeviceProvider/DeviceRegistry diretamente; só consome a API HTTP exposta
 * por lá.
 *
 * Todas as funções aqui têm fallback gracioso: se o plugin-host não estiver
 * de pé (ainda não iniciado, caiu, ou a env var aponta pro lugar errado), o
 * Dashboard não pode quebrar — só mostra "vazio". Por isso todo erro de rede
 * ou de parsing é engolido com um `console.warn`, nunca propagado.
 */

const BASE_URL = process.env.NEXUS_PLUGIN_HOST_URL ?? "http://localhost:4700";

export interface PluginSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly state: string;
}

export interface ProviderSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly deviceCount: number;
}

/** Dados operacionais — sempre busca fresco, nunca usa o cache de fetch do Next. */
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`GET ${path} retornou ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchDevices(): Promise<Device[]> {
  try {
    const dtos = await fetchJson<DeviceDto[]>("/devices");
    return dtos.map(fromDeviceDto);
  } catch (error) {
    console.warn("[nexus-client] falha ao buscar /devices, seguindo com lista vazia:", error);
    return [];
  }
}

export async function fetchEvents(limit = 50): Promise<DeviceEvent[]> {
  try {
    const dtos = await fetchJson<DeviceEventDto[]>(`/events?limit=${limit}`);
    return dtos.map(fromDeviceEventDto);
  } catch (error) {
    console.warn("[nexus-client] falha ao buscar /events, seguindo com lista vazia:", error);
    return [];
  }
}

export async function fetchPlugins(): Promise<PluginSummaryDto[]> {
  try {
    return await fetchJson<PluginSummaryDto[]>("/plugins");
  } catch (error) {
    console.warn("[nexus-client] falha ao buscar /plugins, seguindo com lista vazia:", error);
    return [];
  }
}

export async function fetchProviders(): Promise<ProviderSummaryDto[]> {
  try {
    return await fetchJson<ProviderSummaryDto[]>("/providers");
  } catch (error) {
    console.warn("[nexus-client] falha ao buscar /providers, seguindo com lista vazia:", error);
    return [];
  }
}

/**
 * Dicionário de todas as Capabilities conhecidas pelo Core (o que cada
 * `key` de `Device.capabilities` *significa* — label, descrição, ações).
 * Usado pela UI junto com `resolveDeviceActions` (@nexus/domain) para
 * decidir que botões oferecer por dispositivo, sem nunca checar `kind`.
 */
export async function fetchCapabilities(): Promise<CapabilityDefinition[]> {
  try {
    return await fetchJson<CapabilityDefinition[]>("/capabilities");
  } catch (error) {
    console.warn("[nexus-client] falha ao buscar /capabilities, seguindo com lista vazia:", error);
    return [];
  }
}

export interface DeviceActionInput {
  readonly type: string;
  readonly payload?: Record<string, unknown>;
}

export interface DeviceActionOutcome {
  readonly success: boolean;
  readonly error?: string;
  readonly output?: string;
}

/**
 * Dispara uma DeviceAction (ex.: `{ type: "restart" }`) no plugin-host.
 * Diferente das outras funções deste arquivo, é uma mutação — não deve ser
 * chamada direto de um Server Component durante o render; use-a a partir de
 * um Server Action (ver lib/actions/device-actions.ts), que é o que os
 * Client Components (botões de ação em device-table.tsx) efetivamente
 * chamam.
 */
export async function executeDeviceAction(
  deviceId: string,
  action: DeviceActionInput,
): Promise<DeviceActionOutcome> {
  try {
    const response = await fetch(`${BASE_URL}/devices/${deviceId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`POST /devices/${deviceId}/actions retornou ${response.status}`);
    }

    const result = (await response.json()) as DeviceActionOutcome;
    return { success: result.success, error: result.error, output: result.output };
  } catch (error) {
    console.warn(`[nexus-client] falha ao executar ação "${action.type}" em ${deviceId}:`, error);
    return { success: false, error: "Falha de comunicação com o plugin-host." };
  }
}
