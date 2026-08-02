import { createAuthClient } from "better-auth/client";

export function createNexusAuthClient(baseURL: string): ReturnType<typeof createAuthClient> {
  return createAuthClient({
    baseURL,
  });
}

export type NexusAuthClient = ReturnType<typeof createAuthClient>;
