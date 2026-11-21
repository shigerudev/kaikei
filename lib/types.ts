/**
 * Shared contracts (lock at T+0:30; see SCOPE_AND_TASKS §2).
 * Change a contract here only with the owner's agreement: everyone builds against it.
 */
import { z } from "zod";

// ─── Primitives ────────────────────────────────────────────────────────────────

/** Minor units serialized as a decimal string (bigint is not JSON-safe). e.g. "330000" */
export const MinorString = z.string().regex(/^-?\d+$/);
export type MinorString = z.infer<typeof MinorString>;

/** ISO 4217, e.g. "GTQ" */
export const Currency = z.string().regex(/^[A-Z]{3}$/);
/** YYYY-MM, e.g. "2026-11" */
export const Period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
/** YYYY-MM-DD */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ImportType = z.enum(["budget", "actual"]);
export type ImportType = z.infer<typeof ImportType>;

export type ImportCounts = { new: number; repeat: number; flagged: number };

// ─── K2 Mapping JSON (owner: Hugo) ─────────────────────────────────────────────

export const MappingField = z.enum([
  "date",
  "period",
  "category",
  "amount",
  "currency",
  "description",
  "counterparty",
]);
export type MappingField = z.infer<typeof MappingField>;

export const FieldMapping = z.object({
  column: z.string(),
  confidence: z.number().min(0).max(1),
  /** Raw values from the file, shown beside the proposal. */
  samples: z.array(z.string()),
});

export const MappingProposal = z.object({
  type: ImportType,
  fields: z.partialRecord(MappingField, FieldMapping),
  /** Fields where the owner must choose (two competing columns, or unresolved). */
  ambiguous: z.array(
    z.object({ field: MappingField, candidates: z.array(z.string()) }),
  ),
});
export type MappingProposal = z.infer<typeof MappingProposal>;

// ─── K3 Metrics API (owner: Jose) ──────────────────────────────────────────────

export type AsOf = {
  /** Latest applied import in the workspace (null = empty workspace). */
  importId: string | null;
  /** ISO timestamp of that import's `applied_at`. */
  at: string | null;
};

export type SourceRef =
  | {
      kind: "csv_row";
      transactionId: string;
      fileName: string;
      rowNumber: number;
      appUrl: string;
    }
  | {
      kind: "budget_row";
      budgetLineId: string;
      fileName: string;
      rowNumber: number;
      appUrl: string;
    }
  | { kind: "document"; documentId: string; fileName: string; appUrl: string; blobUrl: string };

export type Contributor = {
  transactionId: string;
  date: string;
  description: string | null;
  counterparty: string | null;
  amountMinor: MinorString;
  currency: string;
  hasEvidence: boolean;
};

/** Every metrics function returns this envelope plus its figures. */
export type MetricsEnvelope = {
  contributors: Contributor[];
  sourceRefs: SourceRef[];
  asOf: AsOf;
};

export type VarianceFigure = {
  period: string;
  categoryId: string | null;
  category: string;
  currency: string;
  budgetMinor: MinorString;
  actualMinor: MinorString;
  /** actual − budget. Positive = over budget. */
  varianceMinor: MinorString;
};

export type VarianceResult = MetricsEnvelope & VarianceFigure & { budgetLineIds: string[] };

export type OverviewResult = MetricsEnvelope & {
  period: string;
  currency: string;
  categories: VarianceFigure[];
  cash: { inMinor: MinorString; outMinor: MinorString };
  openFlags: number;
};

export type CashflowResult = MetricsEnvelope & {
  currency: string;
  months: { period: string; inMinor: MinorString; outMinor: MinorString }[];
};

export type WhatChangedDelta = {
  period: string;
  category: string;
  currency: string;
  field: "actual" | "budget" | "variance";
  beforeMinor: MinorString;
  afterMinor: MinorString;
};

export type WhatChangedResult = MetricsEnvelope & {
  importId: string | null;
  deltas: WhatChangedDelta[];
};

// ─── K4 Extraction JSON (owner: Hugo) ──────────────────────────────────────────

export const Extraction = z.object({
  supplier: z.string().min(1),
  date: IsoDate,
  currency: Currency,
  total_minor: z.number().int().positive(),
  confidence: z.record(z.string(), z.number().min(0).max(1)),
});
export type Extraction = z.infer<typeof Extraction>;

// ─── K5 Match suggestion (owner: Hugo) ─────────────────────────────────────────

export const MatchReason = z.enum([
  "amount_exact",
  "date_within_3d",
  "supplier_in_description",
]);
export type MatchReason = z.infer<typeof MatchReason>;

export const MatchSuggestion = z.object({
  document_id: z.string().uuid(),
  transaction_id: z.string().uuid(),
  score: z.number().min(0).max(1),
  reasons: z.array(MatchReason),
});
export type MatchSuggestion = z.infer<typeof MatchSuggestion>;

// ─── K8 AI suggestion envelope (owner: Hugo) ───────────────────────────────────

export const AiCapability = z.enum([
  "column_mapping",
  "type_guess",
  "category_alias",
  "pdf_extraction",
  "match_tiebreak",
]);
export type AiCapability = z.infer<typeof AiCapability>;

export const AiValidationStatus = z.enum(["valid", "rejected"]);
export type AiValidationStatus = z.infer<typeof AiValidationStatus>;

/** Zod shape for audit rows / MCP. `proposed` stays unknown until capability-specific parsing. */
export const AiSuggestionEnvelope = z.object({
  capability: AiCapability,
  target_ref: z.string().min(1),
  proposed: z.unknown(),
  rationale: z.string().nullable(),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
  context_hash: z.string().min(1),
  validation_status: AiValidationStatus,
});
export type AiSuggestionEnvelope = z.infer<typeof AiSuggestionEnvelope>;

export type AiSuggestion<T> = Omit<AiSuggestionEnvelope, "proposed"> & {
  proposed: T;
};

// ─── Flags (MANIFESTO §4.3; owner: Deyane) ─────────────────────────────────────

export const FlagRule = z.enum([
  "parse_error",
  "unmapped_category",
  "currency_mismatch",
  "possible_duplicate",
  "missing_evidence",
  "uncertain_match",
  "budget_missing",
  /** Stretch: GT 12% VAT-included heuristic. */
  "vat_included_suspect",
]);
export type FlagRule = z.infer<typeof FlagRule>;
