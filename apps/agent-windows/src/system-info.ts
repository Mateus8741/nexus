import os from "node:os";

import type { AgentSystemInfo } from "@nexus/agent-protocol";

/** Informações estáticas do computador, enviadas uma vez no `register`. */
export function collectSystemInfo(): AgentSystemInfo {
  return {
    hostname: os.hostname(),
    operatingSystem: { name: os.type(), version: os.release() },
    ipAddress: firstNonInternalIPv4(),
  };
}

function firstNonInternalIPv4(): string | null {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}
