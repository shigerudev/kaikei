/**
 * Persist every AI attempt to `ai_suggestions` (valid or rejected).
 */
import { createHash } from "node:crypto";
import { db, schema } from "@/lib/db";
import type { AiCapability, AiValidationStatus } from "@/lib/types";

export function contextHash(data: unknown): string {
  return createHash("sha256")
    .update(typeof data === "string" ? data : JSON.stringify(data))
    .digest("hex");
}

export type StoreSuggestionInput = {
  workspaceId: string;
  capability: AiCapability;
  targetRef: string;
  proposed: unknown;
  rationale: string | null;
  model: string;
  promptVersion: string;
  contextHash: string;
  validationStatus: AiValidationStatus;
};

export async function storeAiSuggestion(
  input: StoreSuggestionInput,
): Promise<string> {
  const [row] = await db()
    .insert(schema.aiSuggestions)
    .values({
      workspaceId: input.workspaceId,
      capability: input.capability,
      targetRef: input.targetRef,
      proposed: input.proposed as object,
      rationale: input.rationale,
      model: input.model,
      promptVersion: input.promptVersion,
      contextHash: input.contextHash,
      validationStatus: input.validationStatus,
    })
    .returning({ id: schema.aiSuggestions.id });
  return row.id;
}
