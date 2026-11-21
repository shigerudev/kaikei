/**
 * Flag rule catalog (owner: Deyane). MANIFESTO §4.3.
 * Reads transactions / documents / evidence_links; writes only `flags`. Called after every apply.
 * `parse_error` is raised by ingest/apply (Jose), not here.
 */
import type { FlagRule } from "@/lib/types";
import { notImplemented } from "@/lib/not-implemented";

export type FlagRuleSpec = {
  rule: FlagRule;
  detects: string;
  countedInFigures: "yes" | "no" | "n/a";
};

export const RULES: FlagRuleSpec[] = [
  { rule: "parse_error", detects: "Unparseable date or amount, or missing required field", countedInFigures: "no" },
  { rule: "unmapped_category", detects: "Category not resolved", countedInFigures: "yes" },
  { rule: "currency_mismatch", detects: "Row currency ≠ workspace base currency", countedInFigures: "yes" },
  { rule: "possible_duplicate", detects: "Same date+amount+description in a different file", countedInFigures: "yes" },
  { rule: "missing_evidence", detects: "Expense above threshold with no confirmed document", countedInFigures: "yes" },
  { rule: "uncertain_match", detects: "Document whose best match score is below the threshold", countedInFigures: "n/a" },
  { rule: "budget_missing", detects: "Actuals in a category with no budget for the period", countedInFigures: "yes" },
];

/** TODO(Deyane): run every rule above (except parse_error) for the import; idempotent per import. */
export async function runFlags(workspaceId: string, importId: string): Promise<{ created: number }> {
  void workspaceId;
  void importId;
  return notImplemented("flags.runFlags", "Deyane");
}

/** TODO(Deyane) */
export async function listFlags(workspaceId: string, status?: "open" | "resolved" | "dismissed") {
  void workspaceId;
  void status;
  return notImplemented("flags.listFlags", "Deyane");
}

/** TODO(Deyane) */
export async function setFlagStatus(
  workspaceId: string,
  flagId: string,
  status: "resolved" | "dismissed",
): Promise<void> {
  void workspaceId;
  void flagId;
  void status;
  return notImplemented("flags.setFlagStatus", "Deyane");
}
