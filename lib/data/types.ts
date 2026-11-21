/**
 * UI read models (owner: Jordi). These describe what screens render; they wrap the K-contracts in
 * `lib/types.ts` (owner: Hugo) without changing them. Figures inside are always produced by the
 * data source (`lib/metrics` in db mode, `lib/preview` in preview mode), never by UI code.
 */
import type {
  FlagRule,
  ImportCounts,
  ImportType,
  MappingProposal,
  MatchReason,
  MinorString,
  OverviewResult,
  VarianceResult,
  WhatChangedResult,
} from "@/lib/types";

export type DataSource = "preview" | "db";

export type CategoryKind = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  aliases: string[];
  kind: CategoryKind;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  baseCurrency: string;
  isSample: boolean;
  mcpUrl: string;
  aiEnabled: boolean;
  dataSource: DataSource;
};

export type SourceLocation = { fileName: string; rowNumber: number };

export type TransactionRow = {
  id: string;
  date: string;
  description: string | null;
  counterparty: string | null;
  categoryId: string | null;
  category: string | null;
  amountMinor: MinorString;
  currency: string;
  hasEvidence: boolean;
  flagged: boolean;
  source: SourceLocation;
};

export type LinkedDocument = {
  id: string;
  fileName: string;
  supplier: string | null;
  totalMinor: MinorString | null;
  currency: string | null;
};

export type TransactionDetail = TransactionRow & {
  importId: string;
  headers: string[];
  raw: Record<string, string>;
  documents: LinkedDocument[];
  flags: FlagItem[];
};

export type DocumentStatus = "needs_review" | "matched" | "uncertain";

export type DocumentRow = {
  id: string;
  fileName: string;
  supplier: string | null;
  date: string | null;
  currency: string | null;
  totalMinor: MinorString | null;
  status: DocumentStatus;
  linkedTransactionId: string | null;
  uploadedAt: string;
  fileUrl: string | null;
};

export type MatchCandidate = {
  transactionId: string;
  date: string;
  description: string | null;
  category: string | null;
  amountMinor: MinorString;
  currency: string;
  score: number;
  reasons: MatchReason[];
  status: "suggested" | "confirmed" | "rejected";
};

export type DocumentDetail = DocumentRow & {
  extractedBy: "ai" | "sample" | "manual";
  confidence: Record<string, number> | null;
  candidates: MatchCandidate[];
};

export type FlagItem = {
  id: string;
  rule: FlagRule;
  severity: "info" | "warning" | "error";
  reason: string;
  fileName: string | null;
  rowNumber: number | null;
  column: string | null;
  entity: { type: "transaction" | "document" | "source_row" | "budget_line"; id: string | null; label: string };
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
};

export type ImportRow = {
  id: string;
  fileName: string;
  type: ImportType;
  counts: ImportCounts | null;
  appliedAt: string | null;
};

export type SearchResult = {
  kind: "transaction" | "document" | "category" | "flag";
  id: string;
  title: string;
  subtitle: string;
  amountMinor?: MinorString;
  currency?: string;
  href: string;
};

export type ImportPreview = {
  importId: string;
  fileName: string;
  alreadyImported: boolean;
  proposal: MappingProposal;
  headers: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
};

export type ApplyResult = {
  importId: string;
  counts: ImportCounts;
  changed: WhatChangedResult;
};

export type TransactionFilters = {
  period?: string;
  categoryId?: string;
  hasEvidence?: boolean;
  flagged?: boolean;
  query?: string;
};

export type { OverviewResult, VarianceResult, WhatChangedResult };
