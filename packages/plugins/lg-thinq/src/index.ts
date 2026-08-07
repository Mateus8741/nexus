import type { CapabilityDefinition, CapabilityRegistry } from "@nexus/domain";
import {
  assertPluginManifest,
  definePlugin,
  type Plugin,
  type PluginManifest,
} from "@nexus/plugins-sdk";

import manifestJson from "../plugin.manifest.json";
import { LgThinqClient, type LgThinqClientOptions } from "./lg-thinq-client";
import { LgThinqDeviceProvider } from "./lg-thinq-device-provider";

/**
 * @nexus/plugin-lg-thinq — plugin de primeira parte para ares-condicionados
 * LG via a API oficial "ThinQ Connect" (Personal Access Token). Assim como
 * o plugin Tuya, fala só com a nuvem — nenhuma dependência de rede local.
 */
const manifest = manifestJson as unknown as PluginManifest;
assertPluginManifest(manifest, "@nexus/plugin-lg-thinq");

export { LgThinqApiError, LgThinqClient, type LgThinqClientOptions } from "./lg-thinq-client";
export { LgThinqDeviceProvider } from "./lg-thinq-device-provider";

export interface CreateLgThinqPluginOptions extends LgThinqClientOptions {
  /** Space (ambiente) dos dispositivos desta conta LG — ver ProviderAccount em @nexus/domain. */
  readonly spaceId?: string;
  /** Intervalo de polling (ms). Padrão: 30s — mesmo raciocínio do plugin Tuya (a API não empurra eventos sem MQTT/AWS IoT Core, fora de escopo aqui). */
  readonly pollIntervalMs?: number;
  readonly capabilityRegistry: CapabilityRegistry;
}

export interface LgThinqPluginBundle {
  readonly plugin: Plugin;
  readonly provider: LgThinqDeviceProvider;
}

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
    key: "hvac-mode-control",
    label: "Modo de operação",
    actions: [
      {
        type: "set-mode",
        label: "Definir modo (ex.: COOL, FAN, HEAT, AIR_DRY)",
        payloadSchema: { mode: "string" },
      },
    ],
  },
  {
    key: "target-temperature-control",
    label: "Temperatura desejada",
    actions: [
      {
        type: "set-target-temperature",
        label: "Definir temperatura (°C)",
        payloadSchema: { value: "number" },
      },
    ],
  },
  {
    key: "fan-speed-control",
    label: "Velocidade do ventilador",
    actions: [
      {
        type: "set-fan-speed",
        label: "Definir velocidade (ex.: LOW, MID, HIGH, AUTO)",
        payloadSchema: { value: "string" },
      },
    ],
  },
  {
    key: "swing-control",
    label: "Oscilação do fluxo de ar",
    actions: [
      {
        type: "set-swing",
        label: "Ativar/desativar oscilação",
        payloadSchema: { value: "boolean" },
      },
    ],
  },
  {
    key: "display-control",
    label: "Display do aparelho",
    actions: [
      {
        type: "set-display-light",
        label: "Ligar/desligar display",
        payloadSchema: { value: "boolean" },
      },
    ],
  },
  {
    key: "resource-control",
    label: "Controle avançado (resource/property)",
    actions: [
      {
        type: "set-resource",
        label: "Definir resource/property diretamente",
        payloadSchema: { resource: "string", property: "string", value: "string" },
      },
    ],
  },
  { key: "telemetry", label: "Telemetria" },
];

export function createLgThinqPlugin(options: CreateLgThinqPluginOptions): LgThinqPluginBundle {
  const client = new LgThinqClient({
    accessToken: options.accessToken,
    clientId: options.clientId,
    countryCode: options.countryCode,
  });
  const provider = new LgThinqDeviceProvider({
    client,
    spaceId: options.spaceId,
    pollIntervalMs: options.pollIntervalMs,
  });

  const plugin: Plugin = definePlugin({
    manifest,
    onStart(context) {
      for (const definition of CAPABILITY_DEFINITIONS) {
        options.capabilityRegistry.register(definition, manifest.id);
      }
      provider.setLogger(context.logger);
      provider.start();
      context.logger.info(
        `LG ThinQ plugin iniciado — sincronizando dispositivos (país ${options.countryCode}) a cada ${
          (options.pollIntervalMs ?? 30_000) / 1000
        }s.`,
      );
    },
    onStop(context) {
      provider.stop();
      context.logger.info("LG ThinQ plugin parado.");
    },
  });

  return { plugin, provider };
}
