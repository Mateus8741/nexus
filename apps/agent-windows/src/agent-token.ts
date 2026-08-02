import fs from "node:fs";

import { getAgentTokenPath, getInstallDir } from "./paths";

export function readAgentToken(): string | undefined {
  try {
    const token = fs.readFileSync(getAgentTokenPath(), "utf-8").trim();
    return token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

export function writeAgentToken(token: string): void {
  fs.mkdirSync(getInstallDir(), { recursive: true });
  fs.writeFileSync(getAgentTokenPath(), token, { encoding: "utf-8", mode: 0o600 });
}

export function clearAgentToken(): void {
  try {
    fs.unlinkSync(getAgentTokenPath());
  } catch {
    // ignore
  }
}
