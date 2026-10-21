/**
 * API pública para quem embute o Agent (ex.: apps/desktop). O entrypoint
 * headless continua sendo ./index.ts.
 */
export { WindowsAgent, type WindowsAgentOptions } from "./agent";
export { getOrCreateAgentId } from "./agent-id";
export { type DiscoveredCore, discoverCore } from "./discovery";
export { createSystemActions, type SystemActions } from "./system-actions";
