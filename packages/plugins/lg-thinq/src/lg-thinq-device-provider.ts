import type {
  Device,
  DeviceAction,
  DeviceActionResult,
  DeviceAttributeValue,
  DeviceCapability,
  DeviceEvent,
  DeviceProvider,
  DeviceProviderDescriptor,
  DeviceState,
} from "@nexus/domain";
import type { PluginLogger } from "@nexus/plugins-sdk";

import type {
  LgThinqClient,
  LgThinqDeviceSummary,
  LgThinqProfile,
  LgThinqState,
} from "./lg-thinq-client";

const DESCRIPTOR: DeviceProviderDescriptor = { id: "nexus.lgthinq", name: "LG ThinQ" };

/**
 * Tipos de dispositivo ThinQ com mapeamento implementado. Outros
 * deviceType (geladeira, lava-louças etc.) aparecem na lista da API mas são
 * ignorados por este provider até que alguém precise deles — não é
 * tratamento especial de fabricante, é só o que foi implementado até agora
 * (mesma lógica do CATEGORY_TO_KIND do plugin Tuya, que também não cobre
 * toda categoria Tuya existente).
 */
const SUPPORTED_DEVICE_TYPES: ReadonlySet<string> = new Set(["DEVICE_AIR_CONDITIONER"]);

export interface LgThinqDeviceProviderOptions {
  readonly client: LgThinqClient;
  /** Space (ambiente) a atribuir aos dispositivos desta conta — ver ProviderAccount em @nexus/domain. `undefined` = sem ambiente (só ator sem restrição enxerga). */
  readonly spaceId?: string;
  readonly pollIntervalMs?: number;
  readonly logger?: PluginLogger;
}

type DeviceEventListener = (event: DeviceEvent) => void;

/**
 * LgThinqDeviceProvider — implementa DeviceProvider (@nexus/domain) para
 * dispositivos LG ThinQ via a API oficial "ThinQ Connect". Assim como o
 * TuyaDeviceProvider, faz polling periódico em vez de manter uma conexão
 * persistente (a API expõe push via MQTT/AWS IoT Core, mas isso é escopo
 * futuro — polling já é suficiente pra ver estado e mandar comando).
 */
export class LgThinqDeviceProvider implements DeviceProvider {
  readonly descriptor = DESCRIPTOR;

  private readonly devices = new Map<string, Device>();
  private readonly profiles = new Map<string, LgThinqProfile>();
  private readonly listeners = new Set<DeviceEventListener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;
  private logger: PluginLogger | undefined;

  constructor(private readonly options: LgThinqDeviceProviderOptions) {
    this.logger = options.logger;
  }

  setLogger(logger: PluginLogger): void {
    this.logger = logger;
  }

  start(): void {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.options.pollIntervalMs ?? 30_000);
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
    const device = this.devices.get(deviceId);
    if (!device) {
      return { success: false, error: `Dispositivo "${deviceId}" desconhecido.` };
    }

    let result: DeviceActionResult;
    try {
      const body = this.resolveControlBody(deviceId, device, action);
      await this.options.client.controlDevice(deviceId, body);
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

  private resolveControlBody(
    deviceId: string,
    device: Device,
    action: DeviceAction,
  ): Record<string, unknown> {
    const profile = this.profiles.get(deviceId);

    if (action.type === "turn_on") return { operation: { airConOperationMode: "POWER_ON" } };
    if (action.type === "turn_off") return { operation: { airConOperationMode: "POWER_OFF" } };
    if (action.type === "toggle") {
      const currentlyOn = device.state.attributes.power === "POWER_ON";
      return { operation: { airConOperationMode: currentlyOn ? "POWER_OFF" : "POWER_ON" } };
    }

    if (action.type === "set-mode") {
      const mode = action.payload?.mode;
      if (typeof mode !== "string" || mode.length === 0) {
        throw new Error('Ação "set-mode" exige payload.mode (string).');
      }
      assertLegalEnum(profile, ["airConJobMode", "currentJobMode"], mode);
      return { airConJobMode: { currentJobMode: mode } };
    }

    if (action.type === "set-target-temperature") {
      const value = clampNumber(
        action.payload?.value,
        "value",
        readRangeBounds(profile, ["temperature", "targetTemperature"]) ?? { min: 16, max: 30 },
      );
      return { temperatureInUnits: { targetTemperature: value, unit: "C" } };
    }

    if (action.type === "set-fan-speed") {
      const value = action.payload?.value;
      if (typeof value !== "string" || value.length === 0) {
        throw new Error('Ação "set-fan-speed" exige payload.value (string).');
      }
      assertLegalEnum(profile, ["airFlow", "windStrength"], value);
      return { airFlow: { windStrength: value } };
    }

    if (action.type === "set-swing") {
      const value = action.payload?.value;
      if (typeof value !== "boolean") {
        throw new Error('Ação "set-swing" exige payload.value (boolean).');
      }
      return { windDirection: { rotateUpDown: value } };
    }

    if (action.type === "set-display-light") {
      const value = action.payload?.value;
      if (typeof value !== "boolean") {
        throw new Error('Ação "set-display-light" exige payload.value (boolean).');
      }
      return { display: { light: value ? "ON" : "OFF" } };
    }

    if (action.type === "set-resource") {
      const resource = action.payload?.resource;
      const property = action.payload?.property;
      if (typeof resource !== "string" || resource.length === 0) {
        throw new Error('Ação "set-resource" exige payload.resource (string).');
      }
      if (typeof property !== "string" || property.length === 0) {
        throw new Error('Ação "set-resource" exige payload.property (string).');
      }
      return { [resource]: { [property]: action.payload?.value } };
    }

    throw new Error(`Ação "${action.type}" não é suportada pelo provider LG ThinQ.`);
  }

  private async refreshDevice(deviceId: string): Promise<Device | undefined> {
    const cached = this.devices.get(deviceId);
    if (!cached) return undefined;
    const state = await this.options.client.getDeviceState(deviceId);
    if (!state) return cached;
    const mapped: Device = { ...cached, state: mapStateToDeviceState(state) };
    this.devices.set(deviceId, mapped);
    return mapped;
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const summaries = await this.options.client.listDevices();
      const seen = new Set<string>();

      for (const summary of summaries) {
        if (!SUPPORTED_DEVICE_TYPES.has(summary.deviceInfo.deviceType)) continue;
        seen.add(summary.deviceId);

        try {
          let profile = this.profiles.get(summary.deviceId);
          if (!profile) {
            profile = await this.options.client.getDeviceProfile(summary.deviceId);
            if (profile) this.profiles.set(summary.deviceId, profile);
          }

          const state = await this.options.client.getDeviceState(summary.deviceId);
          const mapped = mapToDevice(summary, profile, state, this.options.spaceId);
          const previous = this.devices.get(summary.deviceId);
          this.devices.set(summary.deviceId, mapped);

          if (!previous) {
            this.emit({ type: "device.connected", deviceId: summary.deviceId, occurredAt: new Date() });
          } else if (!statesEqual(previous.state, mapped.state)) {
            this.emit({
              type: "device.state-changed",
              deviceId: summary.deviceId,
              occurredAt: new Date(),
              previousState: previous.state,
              currentState: mapped.state,
            });
          }
        } catch (error) {
          this.logger?.error(
            `Falha ao sincronizar dispositivo LG ThinQ "${summary.deviceId}": ${String(error)}`,
          );
        }
      }

      for (const [id] of this.devices) {
        if (!seen.has(id)) {
          this.emit({ type: "device.disconnected", deviceId: id, occurredAt: new Date(), reason: "removed" });
          this.devices.delete(id);
          this.profiles.delete(id);
        }
      }
    } catch (error) {
      this.logger?.error(`Falha ao sincronizar dispositivos LG ThinQ: ${String(error)}`);
      this.emit({
        type: "device.error",
        deviceId: "nexus.lgthinq",
        occurredAt: new Date(),
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.polling = false;
    }
  }
}

/** Navega `profile.property.<path>` e confirma que o valor é um dos legais em `.value.w` (aceita se o profile não descrever restrição). */
function assertLegalEnum(profile: LgThinqProfile | undefined, path: readonly string[], value: string): void {
  const node = readPropertyNode(profile, path) as { value?: { w?: readonly string[] } } | undefined;
  const legal = node?.value?.w;
  if (Array.isArray(legal) && legal.length > 0 && !legal.includes(value)) {
    throw new Error(`Valor "${value}" não suportado por este dispositivo. Use um de: ${legal.join(", ")}.`);
  }
}

function readRangeBounds(
  profile: LgThinqProfile | undefined,
  path: readonly string[],
): { min: number; max: number } | undefined {
  const node = readPropertyNode(profile, path) as {
    value?: { w?: { min?: number; max?: number } };
  } | undefined;
  const range = node?.value?.w;
  if (range && typeof range.min === "number" && typeof range.max === "number") {
    return { min: range.min, max: range.max };
  }
  return undefined;
}

function readPropertyNode(profile: LgThinqProfile | undefined, path: readonly string[]): unknown {
  let node: unknown = (profile as { property?: Record<string, unknown> } | undefined)?.property;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

function clampNumber(value: unknown, field: string, bounds: { min: number; max: number }): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`payload.${field} precisa ser um número entre ${bounds.min} e ${bounds.max}.`);
  }
  return Math.min(bounds.max, Math.max(bounds.min, num));
}

function statesEqual(a: DeviceState, b: DeviceState): boolean {
  if (a.status !== b.status) return false;
  const aKeys = Object.keys(a.attributes);
  const bKeys = Object.keys(b.attributes);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a.attributes[key] === b.attributes[key]);
}

function normalizeAttributeValue(value: unknown): DeviceAttributeValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function mapStateToDeviceState(raw: LgThinqState): DeviceState {
  const state = raw as {
    runState?: { currentState?: string };
    airConJobMode?: { currentJobMode?: string };
    operation?: { airConOperationMode?: string };
    temperature?: { currentTemperature?: number; targetTemperature?: number; unit?: string };
    airFlow?: { windStrength?: string; windStrengthDetail?: string };
    windDirection?: { rotateUpDown?: boolean };
    display?: { light?: string };
  };

  const attributes: Record<string, DeviceAttributeValue> = {};
  if (state.runState?.currentState) attributes.runState = normalizeAttributeValue(state.runState.currentState);
  if (state.airConJobMode?.currentJobMode) attributes.mode = normalizeAttributeValue(state.airConJobMode.currentJobMode);
  if (state.operation?.airConOperationMode) attributes.power = normalizeAttributeValue(state.operation.airConOperationMode);
  if (typeof state.temperature?.currentTemperature === "number") {
    attributes.currentTemperature = state.temperature.currentTemperature;
  }
  if (typeof state.temperature?.targetTemperature === "number") {
    attributes.targetTemperature = state.temperature.targetTemperature;
  }
  if (state.airFlow?.windStrength) attributes.fanSpeed = normalizeAttributeValue(state.airFlow.windStrength);
  if (typeof state.windDirection?.rotateUpDown === "boolean") {
    attributes.swing = state.windDirection.rotateUpDown;
  }
  if (state.display?.light) attributes.displayLight = normalizeAttributeValue(state.display.light);

  // A API ThinQ Connect não expõe um flag de conectividade explícito em
  // /state (diferente da Tuya) — "online" aqui significa "respondeu ao
  // poll". Se o dispositivo ficar inalcançável, o próprio poll() já trata
  // isso via try/catch (loga o erro e mantém o último estado conhecido).
  return { status: "online", attributes, observedAt: new Date() };
}

function isWritable(node: unknown): boolean {
  return Array.isArray((node as { mode?: unknown } | undefined)?.mode) &&
    ((node as { mode: unknown[] }).mode).includes("w");
}

function buildCapabilities(profile: LgThinqProfile | undefined): DeviceCapability[] {
  const capabilities: DeviceCapability[] = [{ key: "telemetry" }];
  const property = (profile as { property?: Record<string, unknown> } | undefined)?.property ?? {};
  const get = (path: readonly string[]): unknown => readPropertyNode(profile, path);

  if (isWritable(get(["operation", "airConOperationMode"]))) {
    capabilities.push({ key: "power-control", actions: ["turn_on", "turn_off", "toggle"] });
  }
  if (isWritable(get(["airConJobMode", "currentJobMode"]))) {
    capabilities.push({ key: "hvac-mode-control", actions: ["set-mode"] });
  }
  if (isWritable(get(["temperature", "targetTemperature"]))) {
    capabilities.push({ key: "target-temperature-control", actions: ["set-target-temperature"] });
  }
  if (isWritable(get(["airFlow", "windStrength"]))) {
    capabilities.push({ key: "fan-speed-control", actions: ["set-fan-speed"] });
  }
  if (isWritable(get(["windDirection", "rotateUpDown"]))) {
    capabilities.push({ key: "swing-control", actions: ["set-swing"] });
  }
  if (isWritable(get(["display", "light"]))) {
    capabilities.push({ key: "display-control", actions: ["set-display-light"] });
  }
  void property;
  capabilities.push({ key: "resource-control", actions: ["set-resource"] });
  return capabilities;
}

/** Mapeamento best-effort de deviceType ThinQ → `Device.kind` (Nexus) — só exibição. */
const DEVICE_TYPE_TO_KIND: Record<string, string> = {
  DEVICE_AIR_CONDITIONER: "climate",
};

function mapToDevice(
  summary: LgThinqDeviceSummary,
  profile: LgThinqProfile | undefined,
  state: LgThinqState | undefined,
  spaceId: string | undefined,
): Device {
  return {
    id: summary.deviceId,
    providerId: DESCRIPTOR.id,
    externalId: summary.deviceId,
    name: summary.deviceInfo.alias || summary.deviceInfo.modelName,
    kind: DEVICE_TYPE_TO_KIND[summary.deviceInfo.deviceType] ?? "device",
    capabilities: buildCapabilities(profile),
    spaceId,
    state: state
      ? mapStateToDeviceState(state)
      : { status: "unknown", attributes: {}, observedAt: new Date() },
  };
}
