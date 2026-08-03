import type { NexusDatabase } from "@nexus/db";
import * as schema from "@nexus/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export interface CreateAuthOptions {
  readonly db: NexusDatabase;
  readonly baseURL: string;
  readonly secret: string;
  readonly trustedOrigins?: readonly string[];
  /**
   * Domínio pai para cookie compartilhado entre subdomínios
   * (ex.: `codewaveds.com.br` para `nex.` + `core.`).
   * Em localhost deixe undefined.
   */
  readonly cookieDomain?: string;
}

export function createAuth(options: CreateAuthOptions) {
  const cookieDomain = options.cookieDomain?.trim();
  const useCrossSubdomain = Boolean(cookieDomain);

  return betterAuth({
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [...(options.trustedOrigins ?? [])],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
      ...(useCrossSubdomain
        ? {
            useSecureCookies: true,
            crossSubDomainCookies: {
              enabled: true,
              domain: cookieDomain,
            },
            defaultCookieAttributes: {
              secure: true,
              sameSite: "lax" as const,
              path: "/",
            },
          }
        : {}),
    },
  });
}

export type NexusAuth = ReturnType<typeof createAuth>;
