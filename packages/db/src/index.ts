/**
 * @nexus/db — schema Drizzle + client Postgres do Nexus.
 *
 * Sem regras de negócio. Só persistência tipada consumida por
 * @nexus/infrastructure e @nexus/auth.
 */

export { type CreateDbOptions, createDb, type NexusDatabase } from "./client";
export * from "./schema";
