import type { Plugin } from "./contracts/plugin";

/**
 * Açúcar sintático para autores de plugin: existe só para dar inferência de
 * tipo em `const meuPlugin = definePlugin({ ... })`. Não faz nada em runtime.
 */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}
