/**
 * LangChain chat model factory. Tracing goes to LangSmith when
 * LANGCHAIN_TRACING_V2 / LANGSMITH_* env vars are set (auto-instrumented).
 */
import { ChatOpenAI } from "@langchain/openai";
import { aiApiKey, aiBaseUrl, aiModelId } from "./config";

export function createSuggestModel(timeoutMs: number): ChatOpenAI {
  const apiKey = aiApiKey();
  if (!apiKey) {
    throw new Error("AI is enabled but OPENAI_API_KEY / AI_GATEWAY_API_KEY is missing");
  }
  const baseURL = aiBaseUrl();
  return new ChatOpenAI({
    model: aiModelId(),
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
    ...(baseURL
      ? { configuration: { baseURL } }
      : {}),
  });
}
