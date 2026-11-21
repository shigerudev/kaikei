/**
 * Stage ④d match suggestion (owner: Hugo). Produces K5.
 * DETERMINISTIC scorer: amount exact (strong), date within ±7 days, supplier token overlap with
 * description/counterparty. Optional AI tie-break among filtered candidates (cut-list item 1).
 * Writes `evidence_links.status = 'suggested'`. Below threshold → `uncertain_match` flag.
 * Review point R5: ONLY an owner confirmation sets `confirmed`. No auto-confirm in the MVP.
 */
import type { MatchSuggestion } from "@/lib/types";
import { notImplemented } from "@/lib/not-implemented";

export const MATCH_THRESHOLD = 0.6; // TODO(Hugo): tune against fixtures

export async function suggestMatches(input: {
  workspaceId: string;
  documentId: string;
}): Promise<MatchSuggestion[]> {
  void input;
  return notImplemented("documents.suggestMatches", "Hugo");
}

/** Sets one link to `confirmed` (DB enforces one confirmed per document). Adds evidence, never amount. */
export async function confirmMatch(input: {
  workspaceId: string;
  documentId: string;
  transactionId: string;
}): Promise<void> {
  void input;
  return notImplemented("documents.confirmMatch", "Hugo");
}

export async function rejectMatch(input: {
  workspaceId: string;
  documentId: string;
  transactionId: string;
}): Promise<void> {
  void input;
  return notImplemented("documents.rejectMatch", "Hugo");
}
