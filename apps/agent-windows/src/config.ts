import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface PersistedConfig {
  readonly coreUrl?: string;
  readonly deviceName?: string;
}

/**
 * Mesmo caminho que `scripts/install.ps1` escreve — ver esse arquivo para o
 * outro lado desse contrato. `%LOCALAPPDATA%` é o padrão em Windows; fora
 * dele (dev/teste em Linux/macOS), cai num caminho equivalente que
 * simplesmente nunca vai existir, então a leitura falha silenciosamente e
 * o Agent segue para as próximas fontes de configuração.
 */
function getConfigPath(): string {
  const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  return path.join(base, "NexusAgent", "config.json");
}

/**
 * Config persistida por `install.ps1` na primeira instalação — existe para
 * que rodar o Agent numa máquina nova não exija setar `NEXUS_CORE_URL`/
 * `NEXUS_DEVICE_NAME` toda vez manualmente (ver README.md, "Instalação
 * permanente"). Variáveis de ambiente sempre têm prioridade sobre isto, se
 * definidas — este arquivo é só um fallback.
 *
 * Nunca lança: arquivo ausente, JSON inválido ou campos com tipo errado
 * resultam simplesmente em `{}` (o chamador cai para a próxima fonte).
 */
export function readPersistedConfig(): PersistedConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const record = parsed as Record<string, unknown>;
    return {
      coreUrl: typeof record.coreUrl === "string" ? record.coreUrl : undefined,
      deviceName: typeof record.deviceName === "string" ? record.deviceName : undefined,
    };
  } catch {
    return {};
  }
}
