/** Tipos compartilhados entre main, preload e renderers (só tipos + constantes puras). */

export type AttributeValue = string | number | boolean | null;

/** Dispositivo no formato enxuto que a UI consome (derivado de GET /devices). */
export type FieldSchema =
  | "string"
  | "number"
  | "boolean"
  | { readonly type: "string"; readonly options?: readonly string[] }
  | { readonly type: "number"; readonly min?: number; readonly max?: number; readonly step?: number; readonly unit?: string }
  | { readonly type: "boolean" };

/** Ação já resolvida contra o registro de capabilities do Core (label + schema do payload). */
export interface ResolvedAction {
  readonly capabilityKey: string;
  readonly actionType: string;
  readonly label: string;
  readonly payloadSchema?: Readonly<Record<string, FieldSchema>>;
  readonly advanced?: boolean;
}

export interface DeviceView {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly providerId: string;
  readonly spaceId?: string;
  readonly status: "online" | "offline" | "unknown";
  readonly attributes: Readonly<Record<string, AttributeValue>>;
  /** Ações de todas as capabilities, achatadas (ex.: turn_on, lock, set-target-temperature). */
  readonly actions: readonly string[];
  readonly capabilityKeys: readonly string[];
  /** Ações com label/schema (vindas de GET /capabilities); ausente em modo demo. */
  readonly resolved?: readonly ResolvedAction[];
}

export interface SpaceView {
  readonly id: string;
  readonly name: string;
}

export type SnapshotMode = "live" | "demo" | "unconfigured";
export type ConnectionState = "connecting" | "ok" | "error";

export interface Snapshot {
  readonly mode: SnapshotMode;
  readonly connection: ConnectionState;
  readonly error?: string;
  readonly devices: readonly DeviceView[];
  readonly spaces: readonly SpaceView[];
  readonly updatedAt: number;
  readonly environmentName: string;
}

export interface AppConfig {
  readonly coreUrl: string;
  readonly deviceName: string;
  readonly environmentName: string;
  readonly launchAtLogin: boolean;
  readonly runAgent: boolean;
  readonly pinned: boolean;
  readonly hasApiKey: boolean;
  readonly demo: boolean;
}

export interface SaveConfigInput {
  readonly coreUrl: string;
  /** Vazio/undefined = manter a chave já salva. */
  readonly apiKey?: string;
  readonly deviceName: string;
  readonly environmentName: string;
  readonly launchAtLogin: boolean;
  readonly runAgent: boolean;
}

export interface ActionRequest {
  readonly deviceId: string;
  readonly type: string;
  readonly payload?: Record<string, unknown>;
}

export interface ActionOutcome {
  readonly deviceId: string;
  readonly success: boolean;
  readonly error?: string;
  readonly output?: string;
}

export interface TestConnectionResult {
  readonly ok: boolean;
  readonly message: string;
  readonly deviceCount?: number;
}

export type AgentState = "disabled" | "starting" | "pending" | "online" | "offline" | "rejected";

export interface AgentStatus {
  readonly state: AgentState;
  readonly detail?: string;
}

/** Superfície exposta pelo preload em `window.nexus`. */
export interface NexusBridge {
  readonly platform: NodeJS.Platform;
  getSnapshot(): Promise<Snapshot>;
  onSnapshot(listener: (snapshot: Snapshot) => void): () => void;
  refresh(): Promise<void>;
  runActions(requests: readonly ActionRequest[]): Promise<ActionOutcome[]>;
  getConfig(): Promise<AppConfig>;
  saveConfig(input: SaveConfigInput): Promise<AppConfig>;
  testConnection(coreUrl: string, apiKey?: string): Promise<TestConnectionResult>;
  getAgentStatus(): Promise<AgentStatus>;
  onAgentStatus(listener: (status: AgentStatus) => void): () => void;
  setPinned(pinned: boolean): Promise<boolean>;
  onPinned(listener: (pinned: boolean) => void): () => void;
  hideWidget(): void;
  openSettings(): void;
  closeSettings(): void;
  quit(): void;
  getVersion(): Promise<string>;
}

export const IPC = {
  snapshot: "nexus:snapshot",
  getSnapshot: "nexus:get-snapshot",
  refresh: "nexus:refresh",
  runActions: "nexus:run-actions",
  getConfig: "nexus:get-config",
  saveConfig: "nexus:save-config",
  testConnection: "nexus:test-connection",
  agentStatus: "nexus:agent-status",
  getAgentStatus: "nexus:get-agent-status",
  setPinned: "nexus:set-pinned",
  pinned: "nexus:pinned",
  hideWidget: "nexus:hide-widget",
  openSettings: "nexus:open-settings",
  closeSettings: "nexus:close-settings",
  quit: "nexus:quit",
  getVersion: "nexus:get-version",
} as const;
