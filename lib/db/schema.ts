/**
 * K1 — DB schema (owner: Jose). Source: MANIFESTO §4.2.
 *
 * Invariants enforced here, not in app code:
 * - Money is `bigint` minor units + ISO currency. Never floats.
 * - `source_files` and `source_rows` are append-only originals: never UPDATE them.
 * - One transaction per fingerprint per workspace (repeat-import dedupe).
 * - One active budget line per (workspace, period, category, currency).
 * - One confirmed evidence link per document.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type {
  AiCapability,
  FlagRule,
  ImportCounts,
  MappingProposal,
  MatchReason,
  WhatChangedDelta,
} from "@/lib/types";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: "bigint" });
const currency = (name = "currency") => char(name, { length: 3 });

export const sourceFileKind = pgEnum("source_file_kind", [
  "csv_budget",
  "csv_actual",
  "pdf",
]);
export const importType = pgEnum("import_type", ["budget", "actual"]);
export const importStatus = pgEnum("import_status", ["proposed", "applied"]);
export const documentStatus = pgEnum("document_status", ["extracted", "reviewed"]);
export const evidenceStatus = pgEnum("evidence_status", [
  "suggested",
  "confirmed",
  "rejected",
]);
export const flagSeverity = pgEnum("flag_severity", ["info", "warning", "error"]);
export const flagStatus = pgEnum("flag_status", ["open", "resolved", "dismissed"]);
export const aiValidationStatus = pgEnum("ai_validation_status", [
  "valid",
  "rejected",
]);
export const aiReviewOutcome = pgEnum("ai_review_outcome", [
  "pending",
  "accepted",
  "edited",
  "rejected",
]);

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  baseCurrency: currency("base_currency").notNull(),
  mcpToken: text("mcp_token").notNull().unique(),
  isSample: boolean("is_sample").notNull().default(false),
  createdAt: createdAt(),
});

export const categories = pgTable(
  "categories",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [uniqueIndex("categories_ws_name_uq").on(t.workspaceId, t.name)],
);

export const sourceFiles = pgTable(
  "source_files",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: sourceFileKind("kind").notNull(),
    filename: text("filename").notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    blobUrl: text("blob_url").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("source_files_ws_sha_uq").on(t.workspaceId, t.sha256)],
);

export const sourceRows = pgTable(
  "source_rows",
  {
    id: id(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => sourceFiles.id, { onDelete: "cascade" }),
    /** 1-based row number as the owner sees it in a spreadsheet (header = row 1). */
    rowNumber: integer("row_number").notNull(),
    raw: jsonb("raw").$type<Record<string, string>>().notNull(),
  },
  (t) => [uniqueIndex("source_rows_file_row_uq").on(t.fileId, t.rowNumber)],
);

export const imports = pgTable("imports", {
  id: id(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => sourceFiles.id, { onDelete: "cascade" }),
  type: importType("type").notNull(),
  mapping: jsonb("mapping").$type<MappingProposal>(),
  status: importStatus("status").notNull().default("proposed"),
  counts: jsonb("counts").$type<ImportCounts>(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    /** Signed minor units: negative = money out. */
    amountMinor: money("amount_minor").notNull(),
    currency: currency().notNull(),
    /** Null = "Uncategorized" (and an `unmapped_category` flag). */
    categoryId: uuid("category_id").references(() => categories.id),
    description: text("description"),
    counterparty: text("counterparty"),
    fingerprint: text("fingerprint").notNull(),
    sourceRowId: uuid("source_row_id")
      .notNull()
      .references(() => sourceRows.id),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("transactions_ws_fingerprint_uq").on(t.workspaceId, t.fingerprint),
    index("transactions_ws_date_idx").on(t.workspaceId, t.date),
    index("transactions_ws_category_idx").on(t.workspaceId, t.categoryId),
  ],
);

export const budgetLines = pgTable(
  "budget_lines",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** YYYY-MM */
    period: char("period", { length: 7 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    currency: currency().notNull(),
    amountMinor: money("amount_minor").notNull(),
    sourceRowId: uuid("source_row_id")
      .notNull()
      .references(() => sourceRows.id),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id),
    /** Set when a newer budget import replaces this line. History is kept. */
    supersededBy: uuid("superseded_by").references((): AnyPgColumn => budgetLines.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("budget_lines_active_key_uq")
      .on(t.workspaceId, t.period, t.categoryId, t.currency)
      .where(sql`${t.supersededBy} is null`),
  ],
);

export const documents = pgTable("documents", {
  id: id(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => sourceFiles.id, { onDelete: "cascade" }),
  supplier: text("supplier"),
  docDate: date("doc_date", { mode: "string" }),
  currency: currency(),
  totalMinor: money("total_minor"),
  fieldsConfidence: jsonb("fields_confidence").$type<Record<string, number>>(),
  status: documentStatus("status").notNull().default("extracted"),
  createdAt: createdAt(),
});

export const evidenceLinks = pgTable(
  "evidence_links",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    status: evidenceStatus("status").notNull().default("suggested"),
    /** 0..1 match score (not money, so a float is fine). */
    score: real("score").notNull(),
    reasons: jsonb("reasons").$type<MatchReason[]>().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.transactionId] }),
    uniqueIndex("evidence_links_one_confirmed_per_doc_uq")
      .on(t.documentId)
      .where(sql`${t.status} = 'confirmed'`),
  ],
);

export const flags = pgTable(
  "flags",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    importId: uuid("import_id").references(() => imports.id),
    rule: text("rule").$type<FlagRule>().notNull(),
    severity: flagSeverity("severity").notNull(),
    /** e.g. "transaction" | "source_row" | "document" | "budget_line" */
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    fileId: uuid("file_id").references(() => sourceFiles.id),
    rowNumber: integer("row_number"),
    column: text("column"),
    reason: text("reason").notNull(),
    status: flagStatus("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("flags_ws_status_idx").on(t.workspaceId, t.status)],
);

export const changeEvents = pgTable("change_events", {
  id: id(),
  importId: uuid("import_id")
    .notNull()
    .references(() => imports.id, { onDelete: "cascade" }),
  deltas: jsonb("deltas").$type<WhatChangedDelta[]>().notNull(),
  createdAt: createdAt(),
});

/** K8 — audit trail for every AI proposal (owner: Hugo). */
export const aiSuggestions = pgTable("ai_suggestions", {
  id: id(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  capability: text("capability").$type<AiCapability>().notNull(),
  /** What the proposal is about, e.g. "import:<id>" or "document:<id>". */
  targetRef: text("target_ref").notNull(),
  proposed: jsonb("proposed").notNull(),
  rationale: text("rationale"),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  contextHash: text("context_hash").notNull(),
  validationStatus: aiValidationStatus("validation_status").notNull(),
  reviewOutcome: aiReviewOutcome("review_outcome").notNull().default("pending"),
  createdAt: createdAt(),
});
