import { createHash, randomBytes } from "node:crypto";

const AGENT_TOKEN_PREFIX = "nxt_";
const API_KEY_PREFIX = "nxk_";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAgentToken(): { token: string; hash: string; prefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const token = `${AGENT_TOKEN_PREFIX}${secret}`;
  return { token, hash: hashToken(token), prefix: AGENT_TOKEN_PREFIX };
}

export function generateApiKey(): { token: string; hash: string; prefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const token = `${API_KEY_PREFIX}${secret}`;
  return {
    token,
    hash: hashToken(token),
    prefix: `${API_KEY_PREFIX}${secret.slice(0, 8)}`,
  };
}

export function isAgentToken(value: string): boolean {
  return value.startsWith(AGENT_TOKEN_PREFIX);
}

export function isApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX);
}
