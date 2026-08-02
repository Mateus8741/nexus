import {
  type DeviceDto,
  type DeviceEventDto,
  fromDeviceDto,
  fromDeviceEventDto,
} from "@nexus/application";
import type { Device, DeviceEvent } from "@nexus/domain";

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
