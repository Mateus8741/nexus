import {
  type DeviceDto,
  type DeviceEventDto,
  fromDeviceDto,
  fromDeviceEventDto,
} from "@nexus/application";
import type { CapabilityDefinition, Device, DeviceEvent } from "@nexus/domain";
import { cookies } from "next/headers";

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

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    cache: "no-store",
    headers: { Cookie: await cookieHeader() },
  });

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
    const dtos = await fetchJson<DeviceEventDto[]>(`/events/device?limit=${limit}`);
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

export async function executeDeviceAction(
  deviceId: string,
  action: DeviceActionInput,
): Promise<DeviceActionOutcome> {
  try {
    const response = await fetch(`${BASE_URL}/devices/${deviceId}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: await cookieHeader(),
      },
      body: JSON.stringify({ action }),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as DeviceActionOutcome;
      return {
        success: false,
        error: body.error ?? `POST /devices/${deviceId}/actions retornou ${response.status}`,
      };
    }

    const result = (await response.json()) as DeviceActionOutcome;
    return { success: result.success, error: result.error, output: result.output };
  } catch (error) {
    console.warn(`[nexus-client] falha ao executar ação "${action.type}" em ${deviceId}:`, error);
    return { success: false, error: "Falha de comunicação com o plugin-host." };
  }
}
