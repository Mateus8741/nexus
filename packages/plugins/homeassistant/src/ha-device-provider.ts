import type {
  Device,
  DeviceAction,
  DeviceActionResult,
  DeviceEvent,
  DeviceProvider,
  DeviceProviderDescriptor,
  DeviceState,
} from "@nexus/domain";
import type { PluginLogger } from "@nexus/plugins-sdk";

import type { HaEntityState, HomeAssistantClient } from "./ha-client";
import { buildServiceCalls, mapEntityToDevice, PROVIDER_ID } from "./ha-mapping";

const DESCRIPTOR: DeviceProviderDescriptor = { id: PROVIDER_ID, name: "Home Assistant" };

export interface HomeAssistantDeviceProviderOptions {
  readonly client: HomeAssistantClient;
  /** Space (ambiente) ao qual os dispositivos desta instância pertencem (opcional). */
  readonly spaceId?: string;
  /** Intervalo de polling (ms). Padrão: 15s. */
  readonly pollIntervalMs?: number;
  readonly logger?: PluginLogger;
}

type DeviceEventListener = (event: DeviceEvent) => void;

const DEFAULT_POLL_INTERVAL_MS = 15_000;

/**
 * HomeAssistantDeviceProvider — DeviceProvider (@nexus/domain) para uma
 * instância Home Assistant via API REST. Faz polling de `/api/states`,
 * reconcilia com o estado anterior e emite DeviceEvent quando algo muda.
 * (O SDK não tem canal de push para plugins; a subscrição WebSocket
 * `subscribe_events` do app Swift ficou como evolução futura — ver README.)
 */
export class HomeAssistantDeviceProvider implements DeviceProvider {
  readonly descriptor = DESCRIPTOR;

  private readonly devices = new Map<string, Device>();
  /** Estado bruto da última leitura — necessário para resolver ações (modos suportados, faixas etc.). */
  private readonly raw = new Map<string, HaEntityState>();
  private readonly listeners = new Set<DeviceEventListener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;
  private logger: PluginLogger | undefined;
  private failing = false;

  constructor(private readonly options: HomeAssistantDeviceProviderOptions) {
    this.logger = options.logger;
  }

  setLogger(logger: PluginLogger): void {
    this.logger = logger;
  }

  start(): void {
    if (this.timer) return;
    void this.poll();
    const interval = this.options.pollIntervalMs;
    const ms = Number.isFinite(interval) && (interval as number) >= 1000 ? (interval as number) : DEFAULT_POLL_INTERVAL_MS;
    this.timer = setInterval(() => void this.poll(), ms);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async listDevices(): Promise<readonly Device[]> {
    return Array.from(this.devices.values());
  }

  async getState(deviceId: string): Promise<DeviceState | undefined> {
    return this.devices.get(deviceId)?.state;
  }

  async executeAction(deviceId: string, action: DeviceAction): Promise<DeviceActionResult> {
    let result: DeviceActionResult;
    try {
      const device = this.devices.get(deviceId);
      const entity = this.raw.get(deviceId);
      if (!device || !entity) {
        return { success: false, error: `Dispositivo "${deviceId}" desconhecido.` };
      }
      if (device.state.status === "offline") {
        throw new Error("Dispositivo indisponível no Home Assistant.");
      }
      for (const call of buildServiceCalls(entity, action)) {
        await this.options.client.callService(call);
      }
      const refreshed = await this.refreshDevice(deviceId);
      result = { success: true, resultingState: refreshed?.state };
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : String(error) };
    }

    this.emit({ type: "device.action-executed", deviceId, occurredAt: new Date(), action, result });
    return result;
  }

  subscribe(listener: DeviceEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: DeviceEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private async refreshDevice(deviceId: string): Promise<Device | undefined> {
    const entity = await this.options.client.getState(deviceId);
    if (!entity) return undefined;
    const previous = this.devices.get(deviceId);
    const mapped = mapEntityToDevice(entity, {
      spaceId: this.options.spaceId,
      area: typeof previous?.state.attributes.area === "string" ? previous.state.attributes.area : undefined,
    });
    if (!mapped) return undefined;
    this.raw.set(deviceId, entity);
    this.devices.set(deviceId, mapped);
    return mapped;
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const states = await this.options.client.getStates();
      const areas = await this.options.client.getAreaNames();
      if (this.failing) this.logger?.info("Home Assistant voltou a responder.");
      this.failing = false;

      const seen = new Set<string>();
      for (const entity of states) {
        const mapped = mapEntityToDevice(entity, {
          spaceId: this.options.spaceId,
          area: areas.get(entity.entity_id),
        });
        if (!mapped) continue;
        seen.add(mapped.id);
        const previous = this.devices.get(mapped.id);
        this.raw.set(mapped.id, entity);
        this.devices.set(mapped.id, mapped);

        if (!previous) {
          this.emit({ type: "device.connected", deviceId: mapped.id, occurredAt: new Date() });
        } else if (!statesEqual(previous.state, mapped.state)) {
          this.emit({
            type: "device.state-changed",
            deviceId: mapped.id,
            occurredAt: new Date(),
            previousState: previous.state,
            currentState: mapped.state,
          });
        }
      }

      for (const id of Array.from(this.devices.keys())) {
        if (!seen.has(id)) {
          this.emit({ type: "device.disconnected", deviceId: id, occurredAt: new Date(), reason: "removed" });
          this.devices.delete(id);
          this.raw.delete(id);
        }
      }
    } catch (error) {
      // Mensagens do cliente nunca contêm o token. Loga só na transição para evitar spam a cada ciclo.
      if (!this.failing) {
        this.logger?.error(
          `Falha ao sincronizar com o Home Assistant: ${error instanceof Error ? error.message : "erro desconhecido"}`,
        );
        this.emit({
          type: "device.error",
          deviceId: PROVIDER_ID,
          occurredAt: new Date(),
          message: error instanceof Error ? error.message : String(error),
        });
      }
      this.failing = true;
    } finally {
      this.polling = false;
    }
  }
}

function statesEqual(a: DeviceState, b: DeviceState): boolean {
  if (a.status !== b.status) return false;
  const aKeys = Object.keys(a.attributes);
  const bKeys = Object.keys(b.attributes);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a.attributes[key] === b.attributes[key]);
}
