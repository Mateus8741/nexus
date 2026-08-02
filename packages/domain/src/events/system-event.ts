import type { DeviceEvent } from "./device-event";

interface SystemEventBase {
  readonly occurredAt: Date;
  readonly workspaceId?: string;
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

export interface AuthLoginEvent extends SystemEventBase {
  readonly type: "auth.login";
  readonly userId: string;
  readonly ip?: string;
}

export interface AuthLogoutEvent extends SystemEventBase {
  readonly type: "auth.logout";
  readonly userId: string;
  readonly ip?: string;
}

export interface AuthFailureEvent extends SystemEventBase {
  readonly type: "auth.failure";
  readonly email?: string;
  readonly reason: string;
  readonly ip?: string;
}

export interface AgentRegistrationRequestedEvent extends SystemEventBase {
  readonly type: "agent.registration-requested";
  readonly agentId: string;
  readonly name?: string;
}

export interface AgentApprovedEvent extends SystemEventBase {
  readonly type: "agent.approved";
  readonly agentId: string;
  readonly approvedByUserId: string;
}

export interface AgentRevokedEvent extends SystemEventBase {
  readonly type: "agent.revoked";
  readonly agentId: string;
  readonly revokedByUserId: string;
}

export interface AgentConnectedEvent extends SystemEventBase {
  readonly type: "agent.connected";
  readonly agentId: string;
  readonly ip?: string;
}

export interface PermissionDeniedEvent extends SystemEventBase {
  readonly type: "permission.denied";
  readonly actorId: string;
  readonly actorType: string;
  readonly permission: string;
  readonly resource?: string;
}

export interface InternalErrorEvent extends SystemEventBase {
  readonly type: "internal.error";
  readonly message: string;
  readonly source?: string;
}

/**
 * SystemEvent — união de TUDO que pode passar pelo EventBus do Core.
 */
export type SystemEvent =
  | DeviceEvent
  | PluginLoadedEvent
  | PluginUnloadedEvent
  | CapabilityRegisteredEvent
  | AuthLoginEvent
  | AuthLogoutEvent
  | AuthFailureEvent
  | AgentRegistrationRequestedEvent
  | AgentApprovedEvent
  | AgentRevokedEvent
  | AgentConnectedEvent
  | PermissionDeniedEvent
  | InternalErrorEvent;

export type SystemEventType = SystemEvent["type"];
