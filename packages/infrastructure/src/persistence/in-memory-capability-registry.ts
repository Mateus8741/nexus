import type { CapabilityDefinition, CapabilityRegistry } from "@nexus/domain";

/**
 * Implementação concreta, em memória, de CapabilityRegistry (@nexus/domain).
 * Cada plugin registra suas Capabilities aqui durante o próprio `onStart`
 * (ver ARCHITECTURE.md, "Capability System") — nenhum fabricante recebe
 * tratamento especial: é a mesma chamada `register(definition, pluginId)`
 * para Windows, Docker, Home Assistant ou qualquer plugin futuro.
 */
export class InMemoryCapabilityRegistry implements CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();
  private readonly ownerByKey = new Map<string, string>();

  register(definition: CapabilityDefinition, pluginId: string): void {
    this.definitions.set(definition.key, definition);
    this.ownerByKey.set(definition.key, pluginId);
  }

  get(key: string): CapabilityDefinition | undefined {
    return this.definitions.get(key);
  }

  list(): readonly CapabilityDefinition[] {
    return Array.from(this.definitions.values());
  }

  /** Não faz parte da interface CapabilityRegistry — conveniência para depuração/UI administrativa. */
  ownerOf(key: string): string | undefined {
    return this.ownerByKey.get(key);
  }
}
