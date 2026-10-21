import type { CapabilityDefinition, CapabilityRegistry } from "@nexus/domain";
import {
  assertPluginManifest,
  definePlugin,
  type Plugin,
  type PluginManifest,
} from "@nexus/plugins-sdk";

import manifestJson from "../plugin.manifest.json";
import { HomeAssistantClient, type HomeAssistantClientOptions } from "./ha-client";
import { HomeAssistantDeviceProvider } from "./ha-device-provider";

/**
 * @nexus/plugin-homeassistant — plugin de primeira parte para uma instância
 * Home Assistant (luzes, interruptores, climate e sensores de temperatura)
 * via API REST + token de acesso de longa duração. Port de
 * HomeAssistantService.swift (house-control).
 */
const manifest = manifestJson as unknown as PluginManifest;
assertPluginManifest(manifest, "@nexus/plugin-homeassistant");

export {
  HomeAssistantApiError,
  HomeAssistantClient,
  type HomeAssistantClientOptions,
  normalizeBaseUrl,
} from "./ha-client";
export { HomeAssistantDeviceProvider } from "./ha-device-provider";
export { buildServiceCalls, mapEntityToDevice } from "./ha-mapping";

export interface CreateHomeAssistantPluginOptions extends HomeAssistantClientOptions {
  /** Space ao qual os dispositivos da instância pertencem (opcional; mesmo critério do LG ThinQ). */
  readonly spaceId?: string;
  /** Intervalo de polling (ms). Padrão: 15s. */
  readonly pollIntervalMs?: number;
  readonly capabilityRegistry: CapabilityRegistry;
}

export interface HomeAssistantPluginBundle {
  readonly plugin: Plugin;
  readonly provider: HomeAssistantDeviceProvider;
}

/**
 * Mesmas chaves/ações usadas por Tuya (luz) e LG ThinQ (clima), para a UI
 * reaproveitar os controles. Só registra a chave se ninguém registrou antes,
 * para não sobrescrever o schema de outro plugin.
 */
const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    key: "power-control",
    label: "Controle de energia",
    actions: [
      { type: "turn_on", label: "Ligar" },
      { type: "turn_off", label: "Desligar" },
      { type: "toggle", label: "Alternar" },
    ],
  },
  {
    key: "brightness-control",
    label: "Brilho",
    actions: [
      {
        type: "set-brightness",
        label: "Brilho",
        payloadSchema: { value: { type: "number", min: 0, max: 100, step: 1, unit: "%" } },
      },
    ],
  },
  {
    key: "color-temperature-control",
    label: "Temperatura de cor",
    actions: [
      {
        type: "set-color-temperature",
        label: "Temperatura de cor",
        payloadSchema: { value: { type: "number", min: 0, max: 100, step: 1, unit: "%" } },
      },
    ],
  },
  {
    key: "color-control",
    label: "Cor",
    actions: [
      {
        type: "set-color",
        label: "Cor (HSV)",
        payloadSchema: {
          h: { type: "number", min: 0, max: 360, step: 1, unit: "°" },
          s: { type: "number", min: 0, max: 100, step: 1, unit: "%" },
          v: { type: "number", min: 0, max: 100, step: 1, unit: "%" },
        },
      },
    ],
  },
  {
    key: "hvac-mode-control",
    label: "Modo de operação",
    actions: [
      {
        type: "set-mode",
        label: "Modo",
        payloadSchema: {
          mode: { type: "string", options: ["COOL", "FAN", "AIR_DRY", "HEAT", "AUTO"] },
        },
      },
    ],
  },
  {
    key: "target-temperature-control",
    label: "Temperatura desejada",
    actions: [
      {
        type: "set-target-temperature",
        label: "Temperatura",
        payloadSchema: { value: { type: "number", min: 16, max: 30, step: 0.5, unit: "°C" } },
      },
    ],
  },
  {
    key: "fan-speed-control",
    label: "Velocidade do ventilador",
    actions: [
      {
        type: "set-fan-speed",
        label: "Velocidade",
        payloadSchema: { value: { type: "string", options: ["LOW", "MID", "HIGH", "AUTO"] } },
      },
    ],
  },
  {
    key: "swing-control",
    label: "Oscilação do fluxo de ar",
    actions: [{ type: "set-swing", label: "Oscilação", payloadSchema: { value: "boolean" } }],
  },
  { key: "telemetry", label: "Telemetria" },
];

export function createHomeAssistantPlugin(
  options: CreateHomeAssistantPluginOptions,
): HomeAssistantPluginBundle {
  const client = new HomeAssistantClient({
    baseUrl: options.baseUrl,
    token: options.token,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
  });
  const provider = new HomeAssistantDeviceProvider({
    client,
    spaceId: options.spaceId,
    pollIntervalMs: options.pollIntervalMs,
  });

  const plugin: Plugin = definePlugin({
    manifest,
    onStart(context) {
      for (const definition of CAPABILITY_DEFINITIONS) {
        if (!options.capabilityRegistry.get(definition.key)) {
          options.capabilityRegistry.register(definition, manifest.id);
        }
      }
      provider.setLogger(context.logger);
      provider.start();
      context.logger.info(
        `Home Assistant plugin iniciado — sincronizando ${client.url} a cada ${
          (options.pollIntervalMs ?? 15_000) / 1000
        }s.`,
      );
    },
    onStop(context) {
      provider.stop();
      context.logger.info("Home Assistant plugin parado.");
    },
  });

  return { plugin, provider };
}
