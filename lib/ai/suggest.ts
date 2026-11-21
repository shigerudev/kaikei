/**
 * K8: the ONLY entry point for AI calls (owner: Hugo).
 *
 * suggest() must:
 * 1. return null immediately when AI_ENABLED=false (the manual path must always work),
 * 2. call the model via AI Gateway with structured output (`generateText({ output: Output.object(...) })`),
 *    using a prompt that treats file content as quoted DATA, never instructions,
 * 3. validate with the Zod schema AND `checkReal` (e.g. proposed column exists, transaction id exists),
 * 4. write an `ai_suggestions` row (valid or rejected),
 * 5. return null on timeout / error / rejection. Rejected proposals are never shown.
 *
 * The AI never produces a figure (Principle 1).
 */
import type { z } from "zod";
import { env } from "@/lib/env";
import type { AiCapability, AiSuggestion } from "@/lib/types";
import { notImplemented } from "@/lib/not-implemented";

export type SuggestRequest<S extends z.ZodType> = {
  workspaceId: string;
  capability: AiCapability;
  targetRef: string;
  promptVersion: string;
  system: string;
  /** Untrusted content (CSV cells, PDF). Will be quoted, never interpolated as instructions. */
  data: unknown;
  /** Optional file input (e.g. PDF bill). */
  file?: { url: string; mediaType: string };
  schema: S;
  /** Real-data checks beyond the schema. Return a reason string to reject. */
  checkReal?: (proposed: z.infer<S>) => Promise<string | null> | string | null;
  timeoutMs?: number;
};

export async function suggest<S extends z.ZodType>(
  req: SuggestRequest<S>,
): Promise<AiSuggestion<z.infer<S>> | null> {
  if (!env().AI_ENABLED) return null;
  void req;
  return notImplemented("ai.suggest", "Hugo");
}
