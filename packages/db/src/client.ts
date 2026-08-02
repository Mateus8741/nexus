import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type NexusDatabase = ReturnType<typeof createDb>;

export interface CreateDbOptions {
  readonly connectionString: string;
  readonly max?: number;
}

export function createDb(options: CreateDbOptions) {
  const client = postgres(options.connectionString, {
    max: options.max ?? 10,
    prepare: false,
  });
  return drizzle(client, { schema });
}
