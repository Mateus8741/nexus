export interface PluginLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Superfície injetada pelo host em cada chamada de lifecycle. Deliberadamente
 * mínima: um plugin só enxerga o que está aqui — nada de acesso direto a
 * @nexus/infrastructure, ao filesystem, ou a outros plugins. Isso é o que
 * torna o SDK "o kernel API" (ver packages/plugins-sdk/src/index.ts).
 */
export interface PluginContext {
  readonly logger: PluginLogger;
  readonly config: Readonly<Record<string, unknown>>;
}
