import { createAuthClient } from "better-auth/client";

export function createNexusAuthClient(baseURL: string): ReturnType<typeof createAuthClient> {
  return createAuthClient({
    baseURL,
    fetchOptions: {
      // Necessário para que o navegador aceite/envie o cookie de sessão
      // quando `baseURL` é um subdomínio diferente (ex.: core.dominio.com
      // vs. nex.dominio.com em produção).
      credentials: "include",
    },
  });
}

export type NexusAuthClient = ReturnType<typeof createAuthClient>;
