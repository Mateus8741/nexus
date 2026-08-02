import type { DeviceEvent } from "./device-event";

interface SystemEventBase {
  readonly occurredAt: Date;
}

export interface PluginLoadedEvent extends SystemEventBase {
  readonly type: "plugin.loaded";
  readonly pluginId: string;
}

export interface PluginUnloadedEvent extends SystemEventBase {
  readonly type: "plugin.unloaded";
  readonly pluginId: string;
}

export interface CapabilityRegisteredEvent extends SystemEventBase {
  readonly type: "capability.registered";
  readonly capabilityKey: string;
  readonly pluginId: string;
}

/**
 * SystemEvent — união de TUDO que pode passar pelo EventBus do Core.
 * Estende DeviceEvent (que já existia, específico de dispositivos) com os
 * eventos de ciclo de vida de plugin/capability pedidos na consolidação do
 * Core.
 *
 * Deliberadamente definido só com primitivos (`pluginId: string`, nunca um
 * `Plugin` de verdade) — isso é o que permite este arquivo viver em
 * @nexus/domain sem criar uma dependência de @nexus/plugins-sdk, que
 * continua zero-dep. Quem tem o objeto `Plugin` real (o composition root,
 * apps/plugin-host) é responsável por traduzir para este formato na hora
 * de publicar no EventBus.
 */
export type SystemEvent =
  | DeviceEvent
  | PluginLoadedEvent
  | PluginUnloadedEvent
  | CapabilityRegisteredEvent;

export type SystemEventType = SystemEvent["type"];
