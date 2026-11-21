/**
 * AI runtime config (owner: Hugo).
 * LangChain + LangSmith are the only model stack used from `suggest()`.
 */
import { env } from "@/lib/env";

export const DEFAULT_AI_TIMEOUT_MS = 8_000;

export function aiEnabled(): boolean {
  return env().AI_ENABLED;
}

export function aiModelId(): string {
  return env().AI_MODEL;
}

/** OpenAI-compatible API key (direct OpenAI, AI Gateway, or other proxy). */
export function aiApiKey(): string | undefined {
  return env().OPENAI_API_KEY ?? env().AI_GATEWAY_API_KEY;
}

/** Optional OpenAI-compatible base URL (e.g. Vercel AI Gateway). */
export function aiBaseUrl(): string | undefined {
  return env().OPENAI_BASE_URL;
}
