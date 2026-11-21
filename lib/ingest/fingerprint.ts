/**
 * Stage ④b dedupe (owner: Jose). MANIFESTO §4.1:
 *   fingerprint = hash(date, amount_minor, currency, normalized description, category)
 *                 + occurrence index within file
 * Stored in `transactions.fingerprint` under UNIQUE(workspace_id, fingerprint),
 * so re-imports and overlapping exports add nothing (Principle 4).
 * The occurrence index keeps two genuinely identical rows in one file distinct.
 */
import { notImplemented } from "@/lib/not-implemented";

export type FingerprintInput = {
  date: string;
  amountMinor: bigint;
  currency: string;
  description: string | null;
  categoryId: string | null;
};

/** TODO(Jose): normalize description (trim, lowercase, collapse spaces, strip accents?) */
export function fingerprint(row: FingerprintInput, occurrenceIndex: number): string {
  void row;
  void occurrenceIndex;
  return notImplemented("ingest.fingerprint", "Jose");
}
