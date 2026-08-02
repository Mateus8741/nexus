import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const AGENT_ID_DIR = path.join(os.homedir(), ".nexus");
const AGENT_ID_FILE = path.join(AGENT_ID_DIR, "agent-id");

/**
 * Um agentId estável entre reconexões e reinícios do processo — é o que o
 * Core usa como Device.id (ver WindowsDeviceProvider, em
 * packages/plugins/windows). Sem isso, cada reinício do Agent apareceria
 * para o Core como um dispositivo novo, perdendo o histórico de estado.
 *
 * Deliberadamente NÃO derivado do hostname: hostnames podem se repetir na
 * rede ou mudar; um UUID persistido localmente é a identidade real.
 */
export function getOrCreateAgentId(): string {
  try {
    const existing = fs.readFileSync(AGENT_ID_FILE, "utf-8").trim();
    if (existing.length > 0) return existing;
  } catch {
    // Arquivo ainda não existe (primeira execução neste computador) — cria abaixo.
  }

  const id = `windows-${crypto.randomUUID()}`;
  fs.mkdirSync(AGENT_ID_DIR, { recursive: true });
  fs.writeFileSync(AGENT_ID_FILE, id, "utf-8");
  return id;
}
