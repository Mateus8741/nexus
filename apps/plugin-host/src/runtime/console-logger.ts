import type { PluginLogger } from "@nexus/plugins-sdk";

/**
 * Implementação mínima de PluginLogger para esta etapa — escreve no
 * console do processo. Uma versão futura pode trocar isso por um logger
 * estruturado (pino, winston) sem que nenhum plugin precise mudar.
 */
export function createConsoleLogger(scope: string): PluginLogger {
  const prefix = `[${scope}]`;
  return {
    debug: (message, meta) => console.debug(prefix, message, meta ?? ""),
    info: (message, meta) => console.info(prefix, message, meta ?? ""),
    warn: (message, meta) => console.warn(prefix, message, meta ?? ""),
    error: (message, meta) => console.error(prefix, message, meta ?? ""),
  };
}
