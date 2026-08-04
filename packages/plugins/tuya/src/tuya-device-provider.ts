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

import type { TuyaClient, TuyaDeviceDto, TuyaDeviceStatusItem } from "./tuya-client";

const DESCRIPTOR: DeviceProviderDescriptor = { id: "nexus.tuya", name: "Tuya" };

/** Códigos de data point comuns para "liga/desliga" em interruptores/tomadas/luzes Tuya. */
const SWITCH_CODE_PATTERN = /^(switch(_\d+)?|switch_led)$/i;

/** Candidatos de data point por recurso, em ordem de preferência (v2 primeiro — faixa 0-1000; v1 — faixa 0-255). */
const BRIGHTNESS_CODES = ["bright_value_v2", "bright_value"] as const;
const COLOR_TEMPERATURE_CODES = ["temp_value_v2", "temp_value"] as const;
const COLOR_CODES = ["colour_data_v2", "colour_data"] as const;
const WORK_MODE_CODE = "work_mode";

/** Mapeamento best-effort de `category` (Tuya) → `Device.kind` (Nexus) — só para exibição, nunca usado para tratamento especial. */
const CATEGORY_TO_KIND: Record<string, string> = {
  cz: "switch",
  kg: "switch",
  pc: "switch",
  dj: "light",
  dc: "light",
  fwd: "light",
  wsdcg: "sensor",
  cwwsq: "sensor",
  mcs: "sensor",
  pir: "sensor",
  ldcg: "sensor",
};

export interface TuyaDeviceProviderOptions {
  readonly client: TuyaClient;
  /** Tuya user ID (uid) cujos dispositivos vinculados (app Smart Life/Tuya) serão sincronizados. */
  readonly uid: string;
  readonly pollIntervalMs?: number;
  readonly logger?: PluginLogger;
}

type DeviceEventListener = (event: DeviceEvent) => void;

/**
 * TuyaDeviceProvider — implementa DeviceProvider (@nexus/domain) para
 * dispositivos Tuya/Smart Life via Tuya Cloud API (OpenAPI).
 *
 * Diferente do Windows (WebSocket + Agent local), aqui não existe processo
 * remoto: a nuvem da Tuya já sabe o estado de cada dispositivo, então este
 * provider apenas faz polling periódico (`getUserDevices`) e reconcilia
 * contra o estado observado anteriormente, emitindo DeviceEvent quando algo
 * muda — sem depender de Local Key nem de rede local.
 */
export class TuyaDeviceProvider implements DeviceProvider {
  readonly descriptor = DESCRIPTOR;

  private readonly devices = new Map<string, Device>();
  private readonly listeners = new Set<DeviceEventListener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;
  private logger: PluginLogger | undefined;

  constructor(private readonly options: TuyaDeviceProviderOptions) {
    this.logger = options.logger;
  }

  /** Permite injetar o PluginLogger do host depois de construído (disponível só em `onStart`). */
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
      const commands = this.resolveCommands(device, action);
      await this.options.client.sendCommands(deviceId, commands);
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

  private resolveCommands(
    device: Device,
    action: DeviceAction,
  ): ReadonlyArray<{ code: string; value: unknown }> {
    if (action.type === "set-datapoint") {
      const code = action.payload?.code;
      if (typeof code !== "string" || code.length === 0) {
        throw new Error('Ação "set-datapoint" exige payload.code (string).');
      }
      return [{ code, value: action.payload?.value }];
    }

    if (action.type === "turn_on" || action.type === "turn_off" || action.type === "toggle") {
      const switchCode = Object.keys(device.state.attributes).find((key) =>
        SWITCH_CODE_PATTERN.test(key),
      );
      if (!switchCode) {
        throw new Error(
          'Dispositivo não expõe um datapoint de liga/desliga ("switch"/"switch_N"/"switch_led").',
        );
      }
      const value =
        action.type === "toggle"
          ? !device.state.attributes[switchCode]
          : action.type === "turn_on";
      return [{ code: switchCode, value }];
    }

    if (action.type === "set-brightness") {
      const code = findDatapointCode(device, BRIGHTNESS_CODES);
      if (!code) {
        throw new Error(
          'Dispositivo não expõe um datapoint de brilho ("bright_value"/"bright_value_v2").',
        );
      }
      const percent = clampPercent(action.payload?.value, "value");
      const commands: Array<{ code: string; value: unknown }> = [
        { code, value: percentToNative(percent, code) },
      ];
      const workMode = findDatapointCode(device, [WORK_MODE_CODE]);
      if (workMode) commands.push({ code: workMode, value: "white" });
      return commands;
    }

    if (action.type === "set-color-temperature") {
      const code = findDatapointCode(device, COLOR_TEMPERATURE_CODES);
      if (!code) {
        throw new Error(
          'Dispositivo não expõe um datapoint de temperatura de cor ("temp_value"/"temp_value_v2").',
        );
      }
      const percent = clampPercent(action.payload?.value, "value");
      const commands: Array<{ code: string; value: unknown }> = [
        { code, value: percentToNative(percent, code) },
      ];
      const workMode = findDatapointCode(device, [WORK_MODE_CODE]);
      if (workMode) commands.push({ code: workMode, value: "white" });
      return commands;
    }

    if (action.type === "set-color") {
      const code = findDatapointCode(device, COLOR_CODES);
      if (!code) {
        throw new Error('Dispositivo não expõe um datapoint de cor ("colour_data"/"colour_data_v2").');
      }
      const h = clampRange(action.payload?.h, 0, 360, "h");
      const s = clampPercent(action.payload?.s, "s");
      const v = clampPercent(action.payload?.v, "v");
      const max = nativeMax(code);
      const colorValue = JSON.stringify({
        h: Math.round(h),
        s: Math.round((s / 100) * max),
        v: Math.round((v / 100) * max),
      });
      const commands = [{ code, value: colorValue }];
      const workMode = findDatapointCode(device, [WORK_MODE_CODE]);
      if (workMode) commands.push({ code: workMode, value: "colour" });
      return commands;
    }

    throw new Error(`Ação "${action.type}" não é suportada pelo provider Tuya.`);
  }

  private async refreshDevice(deviceId: string): Promise<Device | undefined> {
    const dto = await this.options.client.getDevice(deviceId);
    if (!dto) return undefined;
    const mapped = mapTuyaDeviceToDevice(dto);
    this.devices.set(deviceId, mapped);
    return mapped;
  }

  private async poll(): Promise<void> {
    if (this.polling) return; // evita sobreposição se um ciclo demorar mais que o intervalo
    this.polling = true;
    try {
      const remote = await this.options.client.getUserDevices(this.options.uid);
      const seen = new Set<string>();

      for (const dto of remote) {
        seen.add(dto.id);
        const mapped = mapTuyaDeviceToDevice(dto);
        const previous = this.devices.get(dto.id);
        this.devices.set(dto.id, mapped);

        if (!previous) {
          this.emit({ type: "device.connected", deviceId: dto.id, occurredAt: new Date() });
        } else if (!statesEqual(previous.state, mapped.state)) {
          this.emit({
            type: "device.state-changed",
            deviceId: dto.id,
            occurredAt: new Date(),
            previousState: previous.state,
            currentState: mapped.state,
          });
        }
      }

      for (const [id] of this.devices) {
        if (!seen.has(id)) {
          this.emit({ type: "device.disconnected", deviceId: id, occurredAt: new Date(), reason: "removed" });
          this.devices.delete(id);
        }
      }
    } catch (error) {
      this.logger?.error(`Falha ao sincronizar dispositivos Tuya: ${String(error)}`);
      this.emit({
        type: "device.error",
        deviceId: "nexus.tuya",
        occurredAt: new Date(),
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.polling = false;
    }
  }
}

/** Primeiro código, dentre os candidatos (em ordem de preferência), que o dispositivo reporta em `state.attributes`. */
function findDatapointCode(device: Device, candidates: readonly string[]): string | undefined {
  return candidates.find((code) => code in device.state.attributes);
}

/** Faixa nativa Tuya para o code informado: variantes "_v2" usam 0-1000, as demais 0-255. */
function nativeMax(code: string): number {
  return code.endsWith("_v2") ? 1000 : 255;
}

function percentToNative(percent: number, code: string): number {
  return Math.round((percent / 100) * nativeMax(code));
}

function clampPercent(value: unknown, field: string): number {
  return clampRange(value, 0, 100, field);
}

function clampRange(value: unknown, min: number, max: number, field: string): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`payload.${field} precisa ser um número entre ${min} e ${max}.`);
  }
  return Math.min(max, Math.max(min, num));
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

function mapTuyaDeviceToDevice(dto: TuyaDeviceDto): Device {
  const attributes: Record<string, DeviceAttributeValue> = {};
  for (const item of dto.status as readonly TuyaDeviceStatusItem[]) {
    attributes[item.code] = normalizeAttributeValue(item.value);
  }
  if (dto.product_name) attributes.productName = dto.product_name;
  if (dto.ip) attributes.ipAddress = dto.ip;
  attributes.category = dto.category;

  const hasSwitch = Object.keys(attributes).some((key) => SWITCH_CODE_PATTERN.test(key));
  const hasBrightness = BRIGHTNESS_CODES.some((code) => code in attributes);
  const hasColorTemperature = COLOR_TEMPERATURE_CODES.some((code) => code in attributes);
  const hasColor = COLOR_CODES.some((code) => code in attributes);

  const capabilities: DeviceCapability[] = [
    { key: "telemetry" },
    {
      key: "datapoint-control",
      actions: ["set-datapoint"],
    },
    ...(hasSwitch
      ? [{ key: "power-control", actions: ["turn_on", "turn_off", "toggle"] } satisfies DeviceCapability]
      : []),
    ...(hasBrightness
      ? [{ key: "brightness-control", actions: ["set-brightness"] } satisfies DeviceCapability]
      : []),
    ...(hasColorTemperature
      ? [
          {
            key: "color-temperature-control",
            actions: ["set-color-temperature"],
          } satisfies DeviceCapability,
        ]
      : []),
    ...(hasColor
      ? [{ key: "color-control", actions: ["set-color"] } satisfies DeviceCapability]
      : []),
  ];

  return {
    id: dto.id,
    providerId: DESCRIPTOR.id,
    externalId: dto.id,
    name: dto.name,
    kind: CATEGORY_TO_KIND[dto.category] ?? "device",
    capabilities,
    state: {
      status: dto.online ? "online" : "offline",
      attributes,
      observedAt: new Date(),
    },
  };
}
