/**
 * Stage ④a apply (owner: Jose). One DB transaction per import:
 * - actual:  valid rows → `transactions` (ON CONFLICT (workspace_id, fingerprint) DO NOTHING → counted as repeat)
 * - budget:  valid rows → `budget_lines`, superseding the active line for the same key
 * - invalid rows → `flags` (parse_error) with file / row / column. Never dropped.
 * Then: write `change_events` (before → after per affected key), run `runFlags`, set status = applied.
 */
import type { ImportCounts, MappingProposal } from "@/lib/types";
import { notImplemented } from "@/lib/not-implemented";

/** Create an `imports` row in status `proposed` with the mapping proposal attached. */
export async function proposeImport(input: {
  workspaceId: string;
  fileId: string;
}): Promise<{ importId: string; proposal: MappingProposal }> {
  void input;
  return notImplemented("ingest.proposeImport", "Jose + Hugo");
}

/** Apply after the owner confirmed type + mapping (review points R1/R2/R3). */
export async function applyImport(input: {
  workspaceId: string;
  importId: string;
  confirmedMapping: MappingProposal;
}): Promise<{ counts: ImportCounts; changeEventId: string }> {
  void input;
  return notImplemented("ingest.applyImport", "Jose");
}
