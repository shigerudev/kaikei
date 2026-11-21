/**
 * Stage ③a–③c column mapping (owner: Hugo). Produces K2.
 * Order: deterministic header heuristics first → LLM fallback ONLY for unresolved fields
 * (cut-list item 3: heuristics-only must still work).
 */
import type { MappingProposal } from "@/lib/types";
import { notImplemented } from "@/lib/not-implemented";

export type MappingInput = {
  workspaceId: string;
  importId: string;
  headers: string[];
  sampleRows: Record<string, string>[];
};

/**
 * ES/EN header synonyms, e.g. fecha/date, monto/amount, rubro/categoría/category, periodo/period.
 * Also guesses Budget vs Actual (period-only + no dates → budget).
 * TODO(Hugo)
 */
export function proposeByHeuristics(input: MappingInput): MappingProposal {
  void input;
  return notImplemented("mapping.proposeByHeuristics", "Hugo");
}

/**
 * LLM fallback through `suggest()` for fields the heuristics left unresolved.
 * Returns the heuristic proposal unchanged when AI is off or the suggestion is rejected.
 * TODO(Hugo)
 */
export async function proposeMapping(input: MappingInput): Promise<MappingProposal> {
  void input;
  return notImplemented("mapping.proposeMapping", "Hugo");
}

/** Map raw category text to a workspace category via aliases ("entregas" ↔ Deliveries). TODO(Hugo) */
export async function resolveCategory(
  workspaceId: string,
  raw: string,
): Promise<{ categoryId: string | null; confidence: number }> {
  void workspaceId;
  void raw;
  return notImplemented("mapping.resolveCategory", "Hugo");
}
