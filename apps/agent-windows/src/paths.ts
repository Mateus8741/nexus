import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Diretório de instalação do Agent.
 *
 * Ordem: `NEXUS_AGENT_HOME` (override) → `ProgramData\NexusAgent` (serviço /
 * boot SYSTEM, criado por install.ps1 -Mode Service) →
 * `%LOCALAPPDATA%\NexusAgent` (modo UserStartup / legado).
 *
 * Em Linux/macOS (dev) cai num caminho sob homedir que normalmente não
 * existe — leitura de config falha em silêncio e o Agent segue para env/UDP.
 */
export function getInstallDir(): string {
  if (process.env.NEXUS_AGENT_HOME && process.env.NEXUS_AGENT_HOME.length > 0) {
    return process.env.NEXUS_AGENT_HOME;
  }

  if (process.platform === "win32") {
    const programData = process.env.PROGRAMDATA ?? "C:\\ProgramData";
    const machineDir = path.join(programData, "NexusAgent");
    if (fs.existsSync(machineDir)) return machineDir;

    const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "NexusAgent");
  }

  return path.join(os.homedir(), ".local", "share", "NexusAgent");
}

export function getConfigPath(): string {
  return path.join(getInstallDir(), "config.json");
}

export function getAgentIdPath(): string {
  return path.join(getInstallDir(), "agent-id");
}

export function getAgentTokenPath(): string {
  return path.join(getInstallDir(), "agent-token");
}
