import fs from "node:fs";

import { getConfigPath } from "./paths";

export interface PersistedCredentials {
  readonly username: string;
  /** Domínio NetBIOS ou "." para conta local. */
  readonly domain?: string;
  /**
   * Senha protegida com DPAPI `LocalMachine` (Base64), gravada pelo
   * install.ps1 / set-credentials.ps1. Só descriptografa nesta máquina.
   */
  readonly passwordProtected: string;
}

export interface PersistedConfig {
  readonly coreUrl?: string;
  readonly deviceName?: string;
  readonly credentials?: PersistedCredentials;
  /** Se true, o instalador também ligou AutoLogon do Windows com essas credenciais. */
  readonly autoLogon?: boolean;
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
    // `Set-Content -Encoding UTF8` no Windows PowerShell 5.1 (o `powershell.exe`
    // embutido, diferente do `pwsh` moderno) grava um BOM UTF-8 no início do
    // arquivo — `JSON.parse` não tolera esse caractere invisível antes do `{`
    // e lança, então removê-lo aqui é necessário mesmo que install.ps1 evite
    // escrevê-lo (defesa em profundidade: alguém pode reeditar o arquivo com
    // outra ferramenta que reintroduza o BOM).
    const rawWithPossibleBom = fs.readFileSync(getConfigPath(), "utf-8");
    const raw =
      rawWithPossibleBom.charCodeAt(0) === 0xfeff
        ? rawWithPossibleBom.slice(1)
        : rawWithPossibleBom;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const record = parsed as Record<string, unknown>;
    return {
      coreUrl: typeof record.coreUrl === "string" ? record.coreUrl : undefined,
      deviceName: typeof record.deviceName === "string" ? record.deviceName : undefined,
      autoLogon: record.autoLogon === true,
      credentials: parseCredentials(record.credentials),
    };
  } catch {
    return {};
  }
}

function parseCredentials(value: unknown): PersistedCredentials | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.username !== "string" || record.username.length === 0) return undefined;
  if (typeof record.passwordProtected !== "string" || record.passwordProtected.length === 0) {
    return undefined;
  }
  return {
    username: record.username,
    domain: typeof record.domain === "string" ? record.domain : undefined,
    passwordProtected: record.passwordProtected,
  };
}
