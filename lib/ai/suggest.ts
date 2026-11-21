/**
 * K8: the ONLY entry point for AI calls (owner: Hugo).
 *
 * Stack: LangChain (`withStructuredOutput`) + LangSmith tracing.
 * Contract (MANIFESTO / SCOPE):
 * 1. return null immediately when AI_ENABLED=false (manual path must always work),
 * 2. call the model with structured output only — no tools for the model,
 * 3. treat file/CSV content as quoted untrusted DATA,
 * 4. validate with Zod AND `checkReal`,
 * 5. write an `ai_suggestions` row (valid or rejected),
 * 6. return null on timeout / error / rejection. Rejected proposals are never shown.
 *
 * The AI never produces a figure (Principle 1).
 */
import type { z } from "zod";
import type { AiSuggestion } from "@/lib/types";
import { aiEnabled, aiModelId, DEFAULT_AI_TIMEOUT_MS } from "./config";
import { createSuggestModel } from "./model";
import { SUGGEST_SYSTEM_PREAMBLE, buildUserPrompt } from "./prompt";
import { contextHash, storeAiSuggestion } from "./store";

export type SuggestRequest<S extends z.ZodType> = {
  workspaceId: string;
  capability: AiSuggestion<unknown>["capability"];
  targetRef: string;
  promptVersion: string;
  system: string;
  /** Untrusted content (CSV cells, PDF text). Quoted, never treated as instructions. */
  data: unknown;
  /** Optional file URL (e.g. PDF bill). Passed as data reference only. */
  file?: { url: string; mediaType: string };
  schema: S;
  /** Real-data checks beyond the schema. Return a reason string to reject. */
  checkReal?: (proposed: z.infer<S>) => Promise<string | null> | string | null;
  timeoutMs?: number;
};

export async function suggest<S extends z.ZodType>(
  req: SuggestRequest<S>,
): Promise<AiSuggestion<z.infer<S>> | null> {
  if (!aiEnabled()) return null;

  const modelId = aiModelId();
  const timeoutMs = req.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const hash = contextHash({
    capability: req.capability,
    data: req.data,
    file: req.file?.url ?? null,
    promptVersion: req.promptVersion,
  });

  let proposed: unknown = null;
  const rationale: string | null = null;

  try {
    const model = createSuggestModel(timeoutMs);
    // Structured output only — no tools bound for the model.
    const structured = model.withStructuredOutput(req.schema, {
      name: req.capability,
      method: "jsonSchema",
    });

    const user = buildUserPrompt({
      system: req.system,
      data: req.data,
      fileUrl: req.file?.url,
    });

    const raw = await Promise.race([
      structured.invoke([
        { role: "system", content: SUGGEST_SYSTEM_PREAMBLE },
        { role: "user", content: user },
      ]),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ai_timeout")), timeoutMs);
      }),
    ]);

    proposed = raw;
  } catch {
    // timeout / provider / parse errors → audit as rejected, never surface
    try {
      await storeAiSuggestion({
        workspaceId: req.workspaceId,
        capability: req.capability,
        targetRef: req.targetRef,
        proposed: proposed ?? { error: "timeout_or_provider" },
        rationale: "timeout_or_provider_error",
        model: modelId,
        promptVersion: req.promptVersion,
        contextHash: hash,
        validationStatus: "rejected",
      });
    } catch {
      // audit write failure must not break the manual path
    }
    return null;
  }

  const parsed = req.schema.safeParse(proposed);
  if (!parsed.success) {
    await safeStore({
      workspaceId: req.workspaceId,
      capability: req.capability,
      targetRef: req.targetRef,
      proposed,
      rationale: `zod: ${parsed.error.message}`,
      model: modelId,
      promptVersion: req.promptVersion,
      contextHash: hash,
      validationStatus: "rejected",
    });
    return null;
  }

  const realReason = req.checkReal
    ? await req.checkReal(parsed.data)
    : null;
  if (realReason) {
    await safeStore({
      workspaceId: req.workspaceId,
      capability: req.capability,
      targetRef: req.targetRef,
      proposed: parsed.data,
      rationale: realReason,
      model: modelId,
      promptVersion: req.promptVersion,
      contextHash: hash,
      validationStatus: "rejected",
    });
    return null;
  }

  await safeStore({
    workspaceId: req.workspaceId,
    capability: req.capability,
    targetRef: req.targetRef,
    proposed: parsed.data,
    rationale,
    model: modelId,
    promptVersion: req.promptVersion,
    contextHash: hash,
    validationStatus: "valid",
  });

  return {
    capability: req.capability,
    target_ref: req.targetRef,
    proposed: parsed.data,
    rationale,
    model: modelId,
    prompt_version: req.promptVersion,
    context_hash: hash,
    validation_status: "valid",
  };
}

async function safeStore(
  input: Parameters<typeof storeAiSuggestion>[0],
): Promise<void> {
  try {
    await storeAiSuggestion(input);
  } catch {
    // never throw through to callers — manual path must survive
  }
}
