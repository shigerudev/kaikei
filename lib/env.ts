import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so `next build` works without secrets.
 * See `.env.example` for what each variable is for.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  /** OpenAI-compatible key for LangChain ChatOpenAI (direct or gateway). */
  OPENAI_API_KEY: z.string().optional(),
  /** Legacy / gateway alias; used if OPENAI_API_KEY is unset. */
  AI_GATEWAY_API_KEY: z.string().optional(),
  /** Optional OpenAI-compatible base URL (e.g. Vercel AI Gateway). */
  OPENAI_BASE_URL: z.string().url().optional(),
  AI_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  /** LangSmith (auto-read by LangChain when tracing is on). */
  LANGCHAIN_TRACING_V2: z.enum(["true", "false"]).optional(),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
