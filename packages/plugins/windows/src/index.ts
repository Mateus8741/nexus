import type { CapabilityDefinition, CapabilityRegistry, HealthMonitor } from "@nexus/domain";
import type { AgentGateway } from "@nexus/plugins-sdk";
import {
  assertPluginManifest,
  definePlugin,
  type Plugin,
  type PluginManifest,
} from "@nexus/plugins-sdk";

import manifestJson from "../plugin.manifest.json";
import { WindowsDeviceProvider } from "./windows-device-provider";

/**
 * @nexus/plugin-windows — plugin de primeira parte para computadores
 * Windows. É o único pacote do monorepo que "sabe" o que é Windows: o Core
 * (apps/plugin-host) só enxerga isto através das interfaces Plugin e
 * DeviceProvider de @nexus/plugins-sdk/@nexus/domain.
 *
 * `plugin.manifest.json` existe como o artefato de metadados que um plugin
 * "de verdade" (carregado de fora, não embutido) publicaria; validamos
 * contra ele aqui (em vez de confiar cegamente que o JSON está no formato
 * certo) e usamos o resultado, já tipado como PluginManifest, no restante
 * do módulo.
 */
const manifest = manifestJson as unknown as PluginManifest;
assertPluginManifest(manifest, "@nexus/plugin-windows");

export { WindowsDeviceProvider } from "./windows-device-provider";

export interface CreateWindowsPluginOptions {
  readonly agentGateway: AgentGateway;
  /** Rastreamento de heartbeat/timeout genérico (ver ARCHITECTURE.md, "Health Service") — este plugin não implementa seu próprio timer. */
  readonly healthMonitor: HealthMonitor;
  /** Onde este plugin registra o SIGNIFICADO das capabilities que declara em `Device.capabilities` (ver windows-device-provider.ts). */
  readonly capabilityRegistry: CapabilityRegistry;
}

export interface WindowsPluginBundle {
  readonly plugin: Plugin;
  readonly provider: WindowsDeviceProvider;
}

/**
 * Definições das Capabilities que este plugin expõe — precisam bater com
 * as chaves/ações declaradas em `Device.capabilities` dentro de
 * windows-device-provider.ts. Registradas no CapabilityRegistry central no
 * `onStart`, não por dispositivo: são metadados de TIPO (o que "restart"
 * significa), não de instância.
 */
const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  {
    key: "power-control",
    label: "Controle de energia",
    actions: [
      { type: "shutdown", label: "Desligar" },
      { type: "restart", label: "Reiniciar" },
      { type: "lock", label: "Bloquear" },
    ],
  },
  {
    key: "remote-command",
    label: "Comando remoto",
    actions: [
      { type: "executeCommand", label: "Executar comando", payloadSchema: { command: "string" } },
    ],
  },
  { key: "metrics", label: "Métricas" },
];

/**
 * Composition-friendly de propósito: não há singleton nem estado global
 * neste módulo. Quem monta o Core (apps/plugin-host) decide quando e com
 * qual AgentGateway/HealthMonitor/CapabilityRegistry concretos instanciar
 * o plugin.
 */
export function createWindowsPlugin(options: CreateWindowsPluginOptions): WindowsPluginBundle {
  const provider = new WindowsDeviceProvider(options.agentGateway, options.healthMonitor);

  const plugin: Plugin = definePlugin({
    manifest,
    onStart(context) {
      for (const definition of CAPABILITY_DEFINITIONS) {
        options.capabilityRegistry.register(definition, manifest.id);
      }
      context.logger.info("Windows plugin iniciado — aguardando conexões de Agents.");
    },
    onStop(context) {
      context.logger.info("Windows plugin parado.");
    },
  });

  return { plugin, provider };
}
