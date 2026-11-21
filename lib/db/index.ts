import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle client over Neon's WebSocket Pool. We use the Pool driver (not neon-http)
 * because `ingest/apply` must run in a single interactive transaction.
 * Created lazily so builds don't need DATABASE_URL.
 */
let client: NeonDatabase<typeof schema> | undefined;

export function db() {
  client ??= drizzle({
    client: new Pool({ connectionString: env().DATABASE_URL }),
    schema,
  });
  return client;
}

export { schema };
