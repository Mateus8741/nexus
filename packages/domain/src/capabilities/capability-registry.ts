import type { CapabilityDefinition } from "./capability";

/**
 * CapabilityRegistry — guarda, em memória, o dicionário de todas as
 * Capabilities conhecidas pelo Core (ver capability.ts). Cada plugin
 * registra as suas no próprio `onStart`, tipicamente uma vez.
 *
 * Implementação concreta: InMemoryCapabilityRegistry, em
 * @nexus/infrastructure.
 */
export interface CapabilityRegistry {
  /** Idempotente: registrar a mesma `key` de novo apenas substitui a definição anterior. */
  register(definition: CapabilityDefinition, pluginId: string): void;
  get(key: string): CapabilityDefinition | undefined;
  list(): readonly CapabilityDefinition[];
}
