import { EventEmitter } from "node:events";

import { applyOptimistic } from "../shared/devices";
import type {
  ActionOutcome,
  ActionRequest,
  ConnectionState,
  DeviceView,
  FieldSchema,
  ResolvedAction,
  Snapshot,
  SpaceView,
  TestConnectionResult,
} from "../shared/types";
import { createDemoDevices, DEMO_SPACES } from "./demo-data";

const POLL_MS = 3_000;
const TIMEOUT_MS = 8_000;

/** `ws://host:4700` / `wss://…` / `host:4700` → base HTTP(S) sem barra final. */
export function toHttpUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!url) return "";
  if (/^wss?:\/\//i.test(url)) url = url.replace(/^ws/i, "http");
  else if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

export function toWsUrl(raw: string): string {
  const http = toHttpUrl(raw);
  return http ? http.replace(/^http/i, "ws") : "";
}

interface CapabilityDto {
  key: string;
  actions?: { type: string; label?: string; payloadSchema?: Record<string, FieldSchema>; advanced?: boolean }[];
}

interface DeviceDto {
  id: string;
  name: string;
  kind: string;
  providerId: string;
  spaceId?: string;
  capabilities?: { key: string; actions?: string[] }[];
  state?: { status?: DeviceView["status"]; attributes?: DeviceView["attributes"] };
}

function toView(dto: DeviceDto, registry: ReadonlyMap<string, CapabilityDto>): DeviceView {
  const capabilities = dto.capabilities ?? [];
  const resolved: ResolvedAction[] = capabilities.flatMap((c) =>
    (c.actions ?? []).map((type) => {
      const schema = registry.get(c.key)?.actions?.find((a) => a.type === type);
      return { capabilityKey: c.key, actionType: type, label: schema?.label ?? type, payloadSchema: schema?.payloadSchema, advanced: schema?.advanced };
    }),
  );
  return {
    id: dto.id,
    name: dto.name,
    kind: dto.kind,
    providerId: dto.providerId,
    spaceId: dto.spaceId,
    status: dto.state?.status ?? "unknown",
    attributes: dto.state?.attributes ?? {},
    actions: [...new Set(capabilities.flatMap((c) => c.actions ?? []))],
    capabilityKeys: capabilities.map((c) => c.key),
    resolved,
  };
}

async function request<T>(baseUrl: string, apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: unknown };
    const detail = typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(response.status === 401 || response.status === 403 ? `Acesso negado (${detail}). Verifique a API key.` : detail);
  }
  return (await response.json()) as T;
}

export async function testConnection(coreUrl: string, apiKey: string): Promise<TestConnectionResult> {
  const baseUrl = toHttpUrl(coreUrl);
  if (!baseUrl) return { ok: false, message: "Informe a URL do Core." };
  if (!apiKey) return { ok: false, message: "Informe a API key (nxk_…)." };
  try {
    const devices = await request<DeviceDto[]>(baseUrl, apiKey, "/devices");
    return { ok: true, message: `Conectado · ${devices.length} dispositivo(s)`, deviceCount: devices.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: message.includes("fetch failed") ? "Core inacessível nesta URL." : message };
  }
}

export interface BackendSettings {
  readonly mode: "live" | "demo" | "unconfigured";
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly environmentName: string;
}

/**
 * Mantém o último snapshot do Core (polling) e executa ações. Em modo demo
 * (NEXUS_DESKTOP_DEMO=1) simula tudo em memória, sem rede.
 */
export class CoreClient extends EventEmitter {
  private settings: BackendSettings = { mode: "unconfigured", baseUrl: "", apiKey: undefined, environmentName: "Nexus" };
  private timer: ReturnType<typeof setInterval> | undefined;
  private devices: DeviceView[] = [];
  private spaces: SpaceView[] = [];
  private connection: ConnectionState = "connecting";
  private error: string | undefined;
  private updatedAt = 0;
  private demoDevices = createDemoDevices();
  private inflight = false;
  private capabilities = new Map<string, CapabilityDto>();

  configure(settings: BackendSettings): void {
    this.settings = settings;
    this.devices = [];
    this.capabilities = new Map();
    this.spaces = [];
    this.error = undefined;
    this.connection = "connecting";
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (settings.mode === "unconfigured") {
      this.emitSnapshot();
      return;
    }
    void this.refresh();
    if (settings.mode === "live") this.timer = setInterval(() => void this.refresh(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  snapshot(): Snapshot {
    return {
      mode: this.settings.mode,
      connection: this.connection,
      error: this.error,
      devices: this.devices,
      spaces: this.spaces,
      updatedAt: this.updatedAt,
      environmentName: this.settings.environmentName,
    };
  }

  private emitSnapshot(): void {
    this.emit("snapshot", this.snapshot());
  }

  async refresh(): Promise<void> {
    const { mode, baseUrl, apiKey } = this.settings;
    if (mode === "demo") {
      this.devices = this.demoDevices;
      this.spaces = [...DEMO_SPACES];
      this.connection = "ok";
      this.updatedAt = Date.now();
      this.emitSnapshot();
      return;
    }
    if (mode !== "live" || !apiKey || this.inflight) return;
    this.inflight = true;
    try {
      const [devices, , spaces] = await Promise.all([
        request<DeviceDto[]>(baseUrl, apiKey, "/devices"),
        this.loadCapabilities(baseUrl, apiKey),
        request<{ id: string; name: string }[]>(baseUrl, apiKey, "/spaces").catch(() => this.spaces),
      ]);
      this.devices = devices.map((dto) => toView(dto, this.capabilities));
      this.spaces = spaces.map((s) => ({ id: s.id, name: s.name }));
      this.connection = "ok";
      this.error = undefined;
    } catch (error) {
      this.connection = "error";
      const message = error instanceof Error ? error.message : String(error);
      this.error = message.includes("fetch failed") || message.includes("timed out") ? "Core inacessível." : message;
    } finally {
      this.inflight = false;
      this.updatedAt = Date.now();
      this.emitSnapshot();
    }
  }

  /** O registro quase nunca muda: busca uma vez (e de novo enquanto estiver vazio). Falha não derruba o polling. */
  private async loadCapabilities(baseUrl: string, apiKey: string): Promise<void> {
    if (this.capabilities.size > 0) return;
    try {
      const list = await request<CapabilityDto[]>(baseUrl, apiKey, "/capabilities");
      this.capabilities = new Map(list.map((c) => [c.key, c]));
    } catch {
      /* segue só com os nomes das ações */
    }
  }

  async runActions(requests: readonly ActionRequest[]): Promise<ActionOutcome[]> {
    const outcomes = await Promise.all(requests.map((r) => this.runOne(r)));
    if (this.settings.mode === "live") setTimeout(() => void this.refresh(), 900);
    return outcomes;
  }

  private async runOne(action: ActionRequest): Promise<ActionOutcome> {
    const { mode, baseUrl, apiKey } = this.settings;
    if (mode === "demo") {
      this.demoDevices = this.demoDevices.map((d) =>
        d.id === action.deviceId ? applyOptimistic(d, action.type, action.payload) : d,
      );
      await new Promise((r) => setTimeout(r, 120));
      await this.refresh();
      return { deviceId: action.deviceId, success: true };
    }
    if (!apiKey) return { deviceId: action.deviceId, success: false, error: "Sem API key." };
    try {
      const result = await request<{ success: boolean; error?: string; output?: string }>(
        baseUrl,
        apiKey,
        `/devices/${encodeURIComponent(action.deviceId)}/actions`,
        { method: "POST", body: JSON.stringify({ action: { type: action.type, payload: action.payload } }) },
      );
      return { deviceId: action.deviceId, success: result.success, error: result.error, output: result.output };
    } catch (error) {
      return { deviceId: action.deviceId, success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
