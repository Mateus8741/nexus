import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { type PersistedCredentials, readPersistedConfig } from "./config";

const execFileAsync = promisify(execFile);

/**
 * Descriptografa a senha gravada com DPAPI LocalMachine pelo instalador.
 * Usa PowerShell embutido do Windows — o Agent compilado com Bun não tem
 * binding nativo de DPAPI, e spawn pontual é aceitável (só quando uma ação
 * realmente precisa da senha).
 *
 * Retorna `null` se não houver credencial configurada ou se a descriptografia
 * falhar (outro PC, ACL, etc.).
 */
export async function readStoredPassword(): Promise<string | null> {
  const credentials = readPersistedConfig().credentials;
  if (!credentials) return null;
  return unprotectPassword(credentials.passwordProtected);
}

export function readStoredCredentials(): PersistedCredentials | null {
  return readPersistedConfig().credentials ?? null;
}

async function unprotectPassword(passwordProtected: string): Promise<string | null> {
  if (process.platform !== "win32") return null;

  const script = [
    "Add-Type -AssemblyName System.Security",
    `$protected = [Convert]::FromBase64String('${passwordProtected.replace(/'/g, "''")}')`,
    "$plain = [Security.Cryptography.ProtectedData]::Unprotect(",
    "  $protected, $null,",
    "  [Security.Cryptography.DataProtectionScope]::LocalMachine)",
    "[Text.Encoding]::UTF8.GetString($plain)",
  ].join("; ");

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, encoding: "utf8", timeout: 15_000 },
    );
    const password = stdout.replace(/\r?\n$/, "");
    return password.length > 0 ? password : null;
  } catch {
    return null;
  }
}
