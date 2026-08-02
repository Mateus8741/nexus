import type { PluginCapability } from "./contracts/manifest";
import type { Plugin } from "./contracts/plugin";
import {
  InvalidPluginStateTransitionError,
  PluginAlreadyRegisteredError,
  PluginNotFoundError,
} from "./errors";
import { canTransition, type PluginState } from "./lifecycle/state";

export interface RegisteredPlugin {
  readonly plugin: Plugin;
  readonly state: PluginState;
  readonly registeredAt: Date;
}

export interface PluginRegistryEvent {
  readonly type: "registered" | "unregistered" | "state-changed";
  readonly pluginId: string;
}

export type PluginRegistryListener = (event: PluginRegistryEvent) => void;

/**
 * Guarda, em memória, quais plugins o host conhece e em que estado cada um
 * está. Não sabe nada sobre COMO um plugin foi carregado (isso é o
 * PluginLoader) nem sobre O QUE um plugin faz — só identidade e estado.
 *
 * Decoupled de propósito: não depende do Loader, de filesystem, nem de
 * nenhum outro pacote do monorepo. Só das interfaces deste próprio SDK.
 */
export class PluginRegistry {
  private readonly entries = new Map<string, RegisteredPlugin>();
  private readonly listeners = new Set<PluginRegistryListener>();

  register(plugin: Plugin): void {
    const id = plugin.manifest.id;
    if (this.entries.has(id)) {
      throw new PluginAlreadyRegisteredError(id);
    }
    this.entries.set(id, { plugin, state: "registered", registeredAt: new Date() });
    this.emit({ type: "registered", pluginId: id });
  }

  unregister(pluginId: string): void {
    if (!this.entries.has(pluginId)) {
      throw new PluginNotFoundError(pluginId);
    }
    this.entries.delete(pluginId);
    this.emit({ type: "unregistered", pluginId });
  }

  /** Aplica uma transição de estado, validando contra PLUGIN_STATE_TRANSITIONS. */
  setState(pluginId: string, next: PluginState): void {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new PluginNotFoundError(pluginId);
    }
    if (!canTransition(entry.state, next)) {
      throw new InvalidPluginStateTransitionError(pluginId, entry.state, next);
    }
    this.entries.set(pluginId, { ...entry, state: next });
    this.emit({ type: "state-changed", pluginId });
  }

  get(pluginId: string): RegisteredPlugin | undefined {
    return this.entries.get(pluginId);
  }

  has(pluginId: string): boolean {
    return this.entries.has(pluginId);
  }

  list(): RegisteredPlugin[] {
    return Array.from(this.entries.values());
  }

  listByCapability(capability: PluginCapability): RegisteredPlugin[] {
    return this.list().filter((entry) => entry.plugin.manifest.capabilities.includes(capability));
  }

  /** Observabilidade opcional — o registry não emite eventos para nenhum barramento próprio, só notifica quem assinar. */
  subscribe(listener: PluginRegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: PluginRegistryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
