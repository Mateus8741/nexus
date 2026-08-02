import { InvalidManifestError } from "../errors";

/**
 * Capacidades genéricas que um plugin pode declarar. Deliberadamente
 * amplas e sem menção a fabricante/protocolo específico — ver PROJECT.md
 * ("nenhum fabricante deve possuir tratamento especial").
 */
export type PluginCapability =
  | "device-adapter"
  | "network-discovery"
  | "automation-trigger"
  | "automation-action"
  | "event-source"
  | "ui-panel"
  | "notification-channel";

/**
 * Metadados declarativos de um plugin. É a única coisa que o host lê antes
 * de decidir se carrega o plugin — por isso precisa ser serializável (JSON)
 * e não pode conter funções.
 */
export interface PluginManifest {
  /** Identificador único e estável, ex.: "nexus.mqtt". Convenção: kebab/dot-case. */
  id: string;
  /** Nome amigável exibido na UI. */
  name: string;
  /** Versão semântica do próprio plugin (não da API do host). */
  version: string;
  description?: string;
  /** Autor/mantenedor. Informativo apenas — não confere privilégios. */
  author?: string;
  /** Capacidades declaradas; o host só concede ao plugin o que elas exigem. */
  capabilities: PluginCapability[];
  /** Faixa semver da API de @nexus/plugins-sdk que este plugin suporta. */
  engines: {
    nexus: string;
  };
  /** Configuração livre específica do plugin; validada pelo próprio plugin, não pelo SDK. */
  config?: Record<string, unknown>;
}

const ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

/** Type guard em runtime — plugins vêm de fora do processo de type-check, então isso é a fronteira de confiança real. */
export function isPluginManifest(value: unknown): value is PluginManifest {
  if (typeof value !== "object" || value === null) return false;
  const manifest = value as Record<string, unknown>;

  if (typeof manifest.id !== "string" || !ID_PATTERN.test(manifest.id)) return false;
  if (typeof manifest.name !== "string" || manifest.name.trim().length === 0) return false;
  if (typeof manifest.version !== "string" || !SEMVER_PATTERN.test(manifest.version)) return false;
  if (!Array.isArray(manifest.capabilities)) return false;
  if (!manifest.capabilities.every((capability) => typeof capability === "string")) return false;

  const engines = manifest.engines;
  if (typeof engines !== "object" || engines === null) return false;
  if (typeof (engines as Record<string, unknown>).nexus !== "string") return false;

  return true;
}

export function assertPluginManifest(
  value: unknown,
  source = "plugin",
): asserts value is PluginManifest {
  if (!isPluginManifest(value)) {
    throw new InvalidManifestError(source);
  }
}
