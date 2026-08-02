import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getAgentIdPath, getInstallDir } from "./paths";

/**
 * Um agentId estável entre reconexões e reinícios do processo — é o que o
 * Core usa como Device.id (ver WindowsDeviceProvider, em
 * packages/plugins/windows). Sem isso, cada reinício do Agent apareceria
 * para o Core como um dispositivo novo, perdendo o histórico de estado.
 *
 * Deliberadamente NÃO derivado do hostname: hostnames podem se repetir na
 * rede ou mudar; um UUID persistido localmente é a identidade real.
 *
 * Preferência de caminho: pasta de instalação (ProgramData / LOCALAPPDATA,
 * ver paths.ts). Se ainda existir o arquivo legado `~/.nexus/agent-id`
 * (instalações antigas por usuário), migra para a pasta nova na primeira
 * leitura — evita trocar de Device.id ao atualizar o instalador.
 */
export function getOrCreateAgentId(): string {
  const agentIdFile = getAgentIdPath();

  try {
    const existing = fs.readFileSync(agentIdFile, "utf-8").trim();
    if (existing.length > 0) return existing;
  } catch {
    // Ainda não existe neste caminho — tenta legado abaixo.
  }

  const legacyId = readLegacyAgentId();
  if (legacyId) {
    writeAgentId(agentIdFile, legacyId);
    return legacyId;
  }

  const id = `windows-${crypto.randomUUID()}`;
  writeAgentId(agentIdFile, id);
  return id;
}

function readLegacyAgentId(): string | null {
  try {
    const legacyFile = path.join(os.homedir(), ".nexus", "agent-id");
    const existing = fs.readFileSync(legacyFile, "utf-8").trim();
    return existing.length > 0 ? existing : null;
  } catch {
    return null;
  }
}

function writeAgentId(filePath: string, id: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // Garante que a pasta de instalação exista mesmo em primeira execução
  // sem install.ps1 (dev / exe manual).
  fs.mkdirSync(getInstallDir(), { recursive: true });
  fs.writeFileSync(filePath, id, "utf-8");
}
