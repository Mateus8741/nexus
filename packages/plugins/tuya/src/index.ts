import type { CapabilityDefinition, CapabilityRegistry } from "@nexus/domain";
import {
  assertPluginManifest,
  definePlugin,
  type Plugin,
  type PluginManifest,
} from "@nexus/plugins-sdk";

import manifestJson from "../plugin.manifest.json";
import { TuyaClient, type TuyaClientOptions } from "./tuya-client";
import { type TuyaAccountConfig, TuyaDeviceProvider } from "./tuya-device-provider";

/**
 * @nexus/plugin-tuya — plugin de primeira parte para dispositivos
 * Tuya/Smart Life (tomadas, interruptores, sensores, etc.), via Tuya Cloud
 * API. Não depende de rede local nem de Local Key — funciona com o Core
 * hospedado onde for (ver @nexus/plugin-windows para o caso oposto, que
 * depende de um Agent local).
 */
const manifest = manifestJson as unknown as PluginManifest;
assertPluginManifest(manifest, "@nexus/plugin-tuya");

export { TuyaApiError, TuyaClient, type TuyaClientOptions } from "./tuya-client";
export { type TuyaAccountConfig, TuyaDeviceProvider } from "./tuya-device-provider";

export interface CreateTuyaPluginOptions extends TuyaClientOptions {
  /**
   * Contas Tuya (uid + Space) a sincronizar — uma por ambiente/usuário (ver
   * ProviderAccount em @nexus/domain). Substituiu o antigo `uid` único:
   * agora várias pessoas podem ter suas próprias contas Smart Life, cada
   * uma isolada no seu Space, sem precisar compartilhar a mesma conta Tuya.
   */
  readonly accounts: readonly TuyaAccountConfig[];
  /** Intervalo de polling (ms). Padrão: 30s — a Tuya Cloud API não empurra eventos em tempo real sem o serviço de Message Queue (Pulsar), fora de escopo aqui. */
  readonly pollIntervalMs?: number;
  readonly capabilityRegistry: CapabilityRegistry;
}

export interface TuyaPluginBundle {
  readonly plugin: Plugin;
  readonly provider: TuyaDeviceProvider;
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
    key: "brightness-control",
    label: "Brilho",
    actions: [
      {
        type: "set-brightness",
        label: "Definir brilho",
        payloadSchema: { value: "number" },
      },
    ],
  },
  {
    key: "color-temperature-control",
    label: "Temperatura de cor",
    actions: [
      {
        type: "set-color-temperature",
        label: "Definir temperatura de cor",
        payloadSchema: { value: "number" },
      },
    ],
  },
  {
    key: "color-control",
    label: "Cor",
    actions: [
      {
        type: "set-color",
        label: "Definir cor (HSV)",
        payloadSchema: { h: "number", s: "number", v: "number" },
      },
    ],
  },
  {
    key: "datapoint-control",
    label: "Controle avançado (data point)",
    actions: [
      {
        type: "set-datapoint",
        label: "Definir data point",
        payloadSchema: { code: "string", value: "string" },
      },
    ],
  },
  { key: "telemetry", label: "Telemetria" },
];

export function createTuyaPlugin(options: CreateTuyaPluginOptions): TuyaPluginBundle {
  const client = new TuyaClient({
    accessId: options.accessId,
    accessSecret: options.accessSecret,
    endpoint: options.endpoint,
  });
  const provider = new TuyaDeviceProvider({
    client,
    accounts: options.accounts,
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
        `Tuya plugin iniciado — sincronizando ${options.accounts.length} conta(s) a cada ${
          (options.pollIntervalMs ?? 30_000) / 1000
        }s.`,
      );
    },
    onStop(context) {
      provider.stop();
      context.logger.info("Tuya plugin parado.");
    },
  });

  return { plugin, provider };
}
