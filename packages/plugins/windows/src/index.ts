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
}

export interface WindowsPluginBundle {
  readonly plugin: Plugin;
  readonly provider: WindowsDeviceProvider;
}

/**
 * Composition-friendly de propósito: não há singleton nem estado global
 * neste módulo. Quem monta o Core (apps/plugin-host) decide quando e com
 * qual AgentGateway concreto instanciar o plugin.
 */
export function createWindowsPlugin(options: CreateWindowsPluginOptions): WindowsPluginBundle {
  const provider = new WindowsDeviceProvider(options.agentGateway);

  const plugin: Plugin = definePlugin({
    manifest,
    onStart(context) {
      context.logger.info("Windows plugin iniciado — aguardando conexões de Agents.");
    },
    onStop(context) {
      context.logger.info("Windows plugin parado.");
    },
  });

  return { plugin, provider };
}
