/**
 * UI-side API types (owner: Jordi). Hand-written mirror of the engine contracts (SCOPE §2: K2 source ref,
 * K4 finding, K5 FX/IC/journal, K8 run; MANIFESTO §4.4 endpoints) until `lib/api/` is generated from the
 * engine's OpenAPI. When the generated client lands, replace these with re-exports and keep the names.
 * Amounts are decimal strings (`Dec`), never numbers.
 */

export type Dec = string;

export type Severity = "BLOCKER" | "WARNING" | "INFO";
export type FindingStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "ACCEPTED_RISK" | "SUPERSEDED";
export type RunStatus = "CREATED" | "RUNNING" | "DRAFT" | "BLOCKED" | "READY_FOR_REVIEW" | "PUBLISHED" | "FAILED";
export type MatchStatus = "MATCHED" | "MISMATCH" | "ONE_SIDED";
export type FileStatus = "MISSING" | "UPLOADED" | "MAPPING_APPROVED" | "REJECTED";

/** K2 — the end of every trace: file + sheet + row + column. */
export type SourceRef = {
  file_id: string | null;
  filename: string;
  sheet: string | null;
  row: number | null;
  column: string | null;
  cell: string | null;
  raw: string | null;
  note?: string | null;
};

export type Group = { id: string; name: string; reporting_currency: string; scenario: string };

export type Company = {
  id: string;
  name: string;
  country: string;
  functional_currency: string;
  ownership_pct: string;
  consolidation_method: "FULL";
  aliases: string[];
  filename: string;
  format: string;
};

export type FxRate = {
  id: string;
  from_ccy: string;
  to_ccy: string;
  period: string;
  rate_type: "average" | "closing";
  /** Units of to_ccy per 1 from_ccy. */
  rate: Dec;
  units_per_usd: string;
  source: string;
  applies_to: string;
};

export type RateSet = { id: string; version: string; rates: FxRate[] };

export type Parameter = { parameter: string; scope: string; value: string; unit: string; used_for: string; source: string };

export type SourceFile = {
  id: string;
  company_id: string;
  filename: string;
  sha256: string | null;
  uploaded_at: string | null;
  status: FileStatus;
  format: string;
  rows: number | null;
  records: number | null;
  parse_warnings: string[];
  mapping_version: string | null;
};

export type PreviewRow = {
  source: SourceRef;
  local_account: string;
  local_name: string;
  period: string;
  amount_local: Dec;
  currency: string;
  group_account: string | null;
  partner_company_id: string | null;
  statement: "PL" | "BS";
};

export type FilePreview = {
  file_id: string;
  rows: PreviewRow[];
  account_mapping: { local_code: string; local_name: string; group_account: string; type: string; partner: string | null }[];
};

export type RunStage = {
  key: "ingest" | "normalize" | "validate" | "translate" | "match" | "eliminate" | "aggregate";
  label: string;
  status: "done" | "warning" | "blocked" | "pending";
  detail: string;
};

/** K8 */
export type Run = {
  id: string;
  number: number;
  status: RunStatus;
  fingerprint: string;
  scenario: string;
  created_at: string;
  parent_run_id: string | null;
  reason: string | null;
  inputs: { files: { company_id: string; filename: string; sha256: string }[]; mapping_version: string; rate_set_id: string; rule_set_version: string; decisions: string[] };
  stages: RunStage[];
  counts: { records: number; held_back: number; translated: number; matched: number; mismatched: number; one_sided: number; journals: number; findings_open: number; blockers_open: number };
};

export type FactRow = {
  id: string;
  group_account: string;
  name: string;
  statement: "PL" | "BS";
  kind: "line" | "subtotal" | "total";
  period: string;
  contributions_total: Dec;
  adjustments_total: Dec;
  amount: Dec;
  by_company: Record<string, Dec>;
  blocked_companies: string[];
  components: string[];
};

export type Facts = { run_id: string; period: string; statement: "PL" | "BS"; currency: string; rows: FactRow[] };

export type MatchSide = {
  company_id: string;
  group_account: string;
  record_id: string;
  amount_local: Dec;
  currency: string;
  amount_group: Dec;
  source: SourceRef;
};

/** K5 */
export type MatchGroup = {
  id: string;
  flow: string;
  mode: "transaction" | "aggregate";
  status: MatchStatus;
  period: string;
  seller: MatchSide;
  buyer: MatchSide | null;
  difference: Dec;
  tolerance: Dec;
  journal_id: string | null;
  finding_id: string | null;
};

export type Journal = {
  id: string;
  match_group_id: string;
  rule_id: string;
  rule_version: string;
  currency: string;
  period: string;
  flow: string;
  lines: { group_account: string; company_id: string; debit: Dec; credit: Dec }[];
  source_record_ids: string[];
  amount_group: Dec;
};

export type FindingDecision = { action: "RESOLVE" | "ACCEPT_RISK" | "REOPEN"; reason: string; actor: string; at: string; resulting_run_id: string };

/** K4 */
export type Finding = {
  id: string;
  /** Answer-key reference for the fixture pack (E01…E11c); null for organizer data. */
  reference: string | null;
  rule_id: string;
  rule_version: string;
  severity: Severity;
  status: FindingStatus;
  title: string;
  error_type: string;
  company_ids: string[];
  reason: string;
  expected_behavior: string;
  source_refs: SourceRef[];
  expected?: Dec;
  observed?: Dec;
  difference?: Dec;
  currency?: string;
  match_group_id: string | null;
  affects_publication: boolean;
  decisions?: FindingDecision[];
};

export type LineageRecord = { id: string; period: string; amount_local: Dec; amount_group: Dec; source: SourceRef; local_account: string; local_name: string };

export type Lineage = {
  fact_id: string;
  group_account: string;
  name: string;
  period: string;
  statement: "PL" | "BS";
  currency: string;
  amount: Dec;
  contributions_total: Dec;
  adjustments_total: Dec;
  contributions: { company_id: string; excluded: boolean; currency: string; amount_local: Dec; rate: FxRate | null; amount_group: Dec; records: LineageRecord[] }[];
  adjustments: { journal_id: string; match_group_id: string; rule_id: string; rule_version: string; flow: string; period: string; amount_group: Dec; counterparty: string; source_record_ids: string[] }[];
  finding_ids: string[];
};

export type SearchHit = {
  kind: "company" | "account" | "finding" | "file" | "run";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type DataSource = "preview" | "engine";
