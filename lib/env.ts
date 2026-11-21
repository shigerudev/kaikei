import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so `next build` works without secrets.
 * See `.env.example` for what each variable is for.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  AI_MODEL: z.string().default("anthropic/claude-sonnet-5-5"),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
