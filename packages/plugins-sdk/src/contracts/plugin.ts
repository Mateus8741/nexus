import type { PluginContext } from "./context";
import type { PluginManifest } from "./manifest";

/**
 * A interface que todo plugin implementa. `onInstall`/`onUninstall` são
 * opcionais (nem todo plugin precisa de setup/teardown persistente);
 * `onStart`/`onStop` são obrigatórios porque são o mínimo necessário para o
 * host controlar o ciclo de vida.
 */
export interface Plugin {
  readonly manifest: PluginManifest;
  onInstall?(context: PluginContext): void | Promise<void>;
  onStart(context: PluginContext): void | Promise<void>;
  onStop(context: PluginContext): void | Promise<void>;
  onUninstall?(context: PluginContext): void | Promise<void>;
}

const REQUIRED_METHODS = ["onStart", "onStop"] as const;

/** Type guard em runtime — checa a forma mínima, não valida o manifesto (isso é isPluginManifest). */
export function isPlugin(value: unknown): value is Plugin {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!("manifest" in candidate)) return false;
  return REQUIRED_METHODS.every((method) => typeof candidate[method] === "function");
}
