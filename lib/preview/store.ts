import "server-only";
/**
 * Preview data source (owner: Jordi). An in-memory stand-in for the DB + `lib/metrics` that
 * implements the same read contracts, so screens can be built and demoed before Jose's path lands.
 * Lives only in server memory (resets on restart / Settings › Reset). Never used when DATA_SOURCE=db.
 *
 * It follows the manifesto rules on purpose: originals kept raw, dedupe by fingerprint,
 * located parse_error flags, bills add evidence never amount, owner-only confirmation.
 */
import Papa from "papaparse";
import { scoreMatch } from "@/lib/documents/match";
import { proposeByHeuristics } from "@/lib/mapping";
import type {
  AsOf,
  Contributor,
  ImportCounts,
  ImportType,
  MappingProposal,
  MatchReason,
  OverviewResult,
  SourceRef,
  VarianceFigure,
  VarianceResult,
  WhatChangedDelta,
  WhatChangedResult,
} from "@/lib/types";
import type {
  ApplyResult,
  Category,
  DocumentDetail,
  DocumentRow,
  FlagItem,
  ImportPreview,
  ImportRow,
  MatchCandidate,
  SearchResult,
  TransactionDetail,
  TransactionFilters,
  TransactionRow,
} from "@/lib/data/types";
import {
  ACTUAL_HEADERS,
  ACTUAL_ROWS,
  BUDGET_HEADERS,
  BUDGET_ROWS,
  CATEGORIES,
  PREVIEW_WS,
  SAMPLE_EXTRACTIONS,
  uid,
} from "./seed";

// ─── State ──────────────────────────────────────────────────────────────────────

type SourceFile = { id: string; name: string; kind: "csv_budget" | "csv_actual" | "pdf"; sha: string; uploadedAt: string };
type SourceRow = { id: string; fileId: string; rowNumber: number; raw: Record<string, string> };
type Import = {
  id: string;
  fileId: string;
  type: ImportType;
  status: "proposed" | "applied";
  proposal: MappingProposal | null;
  counts: ImportCounts | null;
  appliedAt: string | null;
  headers: string[];
  rows: Record<string, string>[];
};
type Tx = {
  id: string;
  date: string;
  amountMinor: bigint;
  currency: string;
  categoryId: string | null;
  description: string | null;
  counterparty: string | null;
  fingerprint: string;
  sourceRowId: string;
  importId: string;
};
type BudgetLine = {
  id: string;
  period: string;
  categoryId: string;
  currency: string;
  amountMinor: bigint;
  sourceRowId: string;
  importId: string;
  supersededBy: string | null;
};
type Doc = {
  id: string;
  fileId: string;
  supplier: string | null;
  date: string | null;
  currency: string | null;
  totalMinor: bigint | null;
  extractedBy: "ai" | "sample" | "manual";
  confidence: Record<string, number> | null;
};
type Link = { documentId: string; transactionId: string; status: "suggested" | "confirmed" | "rejected"; score: number; reasons: MatchReason[] };
type Flag = Omit<FlagItem, "fileName"> & { fileId: string | null };
type ChangeEvent = { importId: string; deltas: WhatChangedDelta[] };

type State = {
  name: string;
  baseCurrency: string;
  categories: Category[];
  files: SourceFile[];
  rows: SourceRow[];
  imports: Import[];
  txs: Tx[];
  budget: BudgetLine[];
  docs: Doc[];
  links: Link[];
  flags: Flag[];
  changes: ChangeEvent[];
  seq: number;
};

const g = globalThis as unknown as { __kaikeiPreview?: State };

function state(): State {
  g.__kaikeiPreview ??= seed();
  return g.__kaikeiPreview;
}

export function resetPreview() {
  g.__kaikeiPreview = seed();
}

const nextId = (s: State) => uid(10_000 + ++s.seq);

// ─── Parsing helpers (preview only; the real ones are Jose's in lib/ingest + lib/money) ─────────

const norm = (v: string | null | undefined) =>
  (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** "1,200.00" | "1.200,00" | "Q 600" | "(600)" | "-600" | "600-" → minor units; letters → null. */
export function parseAmount(raw: string): bigint | null {
  let s = (raw ?? "").trim().replace(/^(gtq|q)\s*/i, "").replace(/\s/g, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  if (!/^[0-9.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let intPart = s;
  let frac = "";
  // Both separators: the later one is the decimal. One separator: decimal only if it appears once
  // and has 1–2 digits after it ("600.5", "1.200,00"); otherwise it groups thousands ("1,200").
  const decIdx = lastDot >= 0 && lastComma >= 0 ? Math.max(lastDot, lastComma) : -1;
  const single = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
  const singleIdx = single ? s.lastIndexOf(single) : -1;
  const singleIsDecimal = single !== null && s.split(single).length === 2 && s.length - singleIdx - 1 <= 2;
  const idx = decIdx >= 0 ? decIdx : singleIsDecimal ? singleIdx : -1;
  if (idx >= 0) {
    intPart = s.slice(0, idx);
    frac = s.slice(idx + 1);
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(frac)) return null;
  const minor = BigInt(intPart) * 100n + BigInt(frac.padEnd(2, "0") || "0");
  return neg ? -minor : minor;
}

function parseDate(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

function resolveCategoryId(s: State, raw: string): string | null {
  const n = norm(raw);
  if (!n) return null;
  return s.categories.find((c) => norm(c.name) === n || c.aliases.some((a) => norm(a) === n))?.id ?? null;
}

function fingerprint(date: string, amount: bigint, currency: string, description: string | null, rawCategory: string, occurrence: number) {
  return [date, amount.toString(), currency, norm(description), norm(rawCategory), occurrence].join("|");
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const counterpartyOf = (description: string | null) => description?.split(" - ")[0]?.trim() || null;

// ─── Seed ───────────────────────────────────────────────────────────────────────

function seed(): State {
  const s: State = {
    name: "Panadería La Ceiba",
    baseCurrency: "GTQ",
    categories: CATEGORIES.map((c) => ({ ...c })),
    files: [],
    rows: [],
    imports: [],
    txs: [],
    budget: [],
    docs: [],
    links: [],
    flags: [],
    changes: [],
    seq: 0,
  };

  // Budget file + import
  const bFile: SourceFile = { id: uid(101), name: "presupuesto_oct_nov.csv", kind: "csv_budget", sha: "seed-budget", uploadedAt: "2026-10-01T09:12:00.000Z" };
  const bImp: Import = { id: uid(201), fileId: bFile.id, type: "budget", status: "applied", proposal: null, counts: { new: BUDGET_ROWS.length, repeat: 0, flagged: 0 }, appliedAt: bFile.uploadedAt, headers: BUDGET_HEADERS, rows: [] };
  s.files.push(bFile);
  s.imports.push(bImp);
  BUDGET_ROWS.forEach(([period, cat, amount], i) => {
    const row: SourceRow = { id: uid(1000 + i), fileId: bFile.id, rowNumber: i + 2, raw: { periodo: period, categoria: cat, monto: amount, moneda: "GTQ" } };
    s.rows.push(row);
    s.budget.push({ id: uid(2000 + i), period, categoryId: resolveCategoryId(s, cat)!, currency: "GTQ", amountMinor: parseAmount(amount)!, sourceRowId: row.id, importId: bImp.id, supersededBy: null });
  });

  // Actuals file + import
  const aFile: SourceFile = { id: uid(102), name: "banco_export_oct_nov.csv", kind: "csv_actual", sha: "seed-actuals", uploadedAt: "2026-11-15T16:40:00.000Z" };
  const aImp: Import = { id: uid(202), fileId: aFile.id, type: "actual", status: "applied", proposal: null, counts: { new: ACTUAL_ROWS.length, repeat: 0, flagged: 0 }, appliedAt: aFile.uploadedAt, headers: ACTUAL_HEADERS, rows: [] };
  s.files.push(aFile);
  s.imports.push(aImp);
  ACTUAL_ROWS.forEach(([date, desc, cat, amount], i) => {
    const row: SourceRow = { id: uid(3000 + i), fileId: aFile.id, rowNumber: i + 2, raw: { fecha: date, descripcion: desc, categoria: cat, monto: amount, moneda: "GTQ" } };
    s.rows.push(row);
    const amt = parseAmount(amount)!;
    s.txs.push({ id: uid(4000 + i), date, amountMinor: amt, currency: "GTQ", categoryId: resolveCategoryId(s, cat), description: desc, counterparty: counterpartyOf(desc), fingerprint: fingerprint(date, amt, "GTQ", desc, cat, 0), sourceRowId: row.id, importId: aImp.id });
  });

  // Documents: one matched rent receipt, one uncertain hardware bill.
  const rentTx = s.txs.find((t) => t.date === "2026-11-01")!;
  const d1File: SourceFile = { id: uid(103), name: "recibo_renta_noviembre.pdf", kind: "pdf", sha: "seed-doc-1", uploadedAt: "2026-11-02T10:05:00.000Z" };
  const d2File: SourceFile = { id: uid(104), name: "factura_ferreteria_martillo.pdf", kind: "pdf", sha: "seed-doc-2", uploadedAt: "2026-11-09T12:30:00.000Z" };
  s.files.push(d1File, d2File);
  s.docs.push(
    { id: uid(501), fileId: d1File.id, supplier: "Inmobiliaria Las Flores", date: "2026-11-01", currency: "GTQ", totalMinor: 450000n, extractedBy: "sample", confidence: { supplier: 0.98, date: 0.99, currency: 0.99, total: 0.99 } },
    { id: uid(502), fileId: d2File.id, supplier: "Ferretería El Martillo", date: "2026-11-09", currency: "GTQ", totalMinor: 27500n, extractedBy: "sample", confidence: { supplier: 0.91, date: 0.95, currency: 0.99, total: 0.97 } },
  );
  s.links.push({ documentId: uid(501), transactionId: rentTx.id, status: "confirmed", score: 1, reasons: ["amount_exact", "date_within_3d", "supplier_in_description"] });

  // Flags
  const harinas = s.txs.find((t) => t.date === "2026-11-05")!;
  s.flags.push(
    { id: uid(601), rule: "missing_evidence", severity: "warning", reason: "Expense above Q2,500 with no confirmed bill.", fileId: aFile.id, rowNumber: 12, column: null, entity: { type: "transaction", id: harinas.id, label: "Harinas del Sur · −Q3,100.00" }, status: "open", createdAt: aFile.uploadedAt },
    { id: uid(602), rule: "uncertain_match", severity: "info", reason: "No transaction matches Q275.00 from Ferretería El Martillo within ±7 days.", fileId: d2File.id, rowNumber: null, column: null, entity: { type: "document", id: uid(502), label: "factura_ferreteria_martillo.pdf" }, status: "open", createdAt: d2File.uploadedAt },
  );

  s.changes.push({ importId: aImp.id, deltas: [] });
  return s;
}

// ─── Figures (stand-in for lib/metrics; same contract) ────────────────────────────

const ms = (v: bigint) => v.toString();
const periodOf = (date: string) => date.slice(0, 7);
const abs = (v: bigint) => (v < 0n ? -v : v);

function asOf(s: State): AsOf {
  const latest = [...s.imports].filter((i) => i.status === "applied").sort((a, b) => (b.appliedAt ?? "").localeCompare(a.appliedAt ?? ""))[0];
  return { importId: latest?.id ?? null, at: latest?.appliedAt ?? null };
}

function categoryName(s: State, id: string | null) {
  return id ? s.categories.find((c) => c.id === id)?.name ?? "Uncategorized" : "Uncategorized";
}

function fileOfRow(s: State, rowId: string) {
  const row = s.rows.find((r) => r.id === rowId)!;
  const file = s.files.find((f) => f.id === row.fileId)!;
  return { row, file };
}

function hasEvidence(s: State, txId: string) {
  return s.links.some((l) => l.transactionId === txId && l.status === "confirmed");
}

function contributor(s: State, t: Tx): Contributor {
  return { transactionId: t.id, date: t.date, description: t.description, counterparty: t.counterparty, amountMinor: ms(t.amountMinor), currency: t.currency, hasEvidence: hasEvidence(s, t.id) };
}

function refFor(s: State, t: Tx): SourceRef {
  const { row, file } = fileOfRow(s, t.sourceRowId);
  return { kind: "csv_row", transactionId: t.id, fileName: file.name, rowNumber: row.rowNumber, appUrl: `/w/${PREVIEW_WS}/transactions/${t.id}` };
}

function figure(s: State, period: string, categoryId: string | null, currency: string): VarianceFigure & { txs: Tx[]; lines: BudgetLine[] } {
  const txs = s.txs
    .filter((t) => periodOf(t.date) === period && t.categoryId === categoryId && t.currency === currency)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lines = s.budget.filter((b) => b.period === period && b.categoryId === categoryId && b.currency === currency && !b.supersededBy);
  const actual = abs(txs.reduce((sum, t) => sum + t.amountMinor, 0n));
  const budget = lines.reduce((sum, b) => sum + b.amountMinor, 0n);
  return { period, categoryId, category: categoryName(s, categoryId), currency, budgetMinor: ms(budget), actualMinor: ms(actual), varianceMinor: ms(actual - budget), txs, lines };
}

/** Drop the internal record lists, keeping only the contract figure. */
function bare(f: ReturnType<typeof figure>): VarianceFigure {
  return { period: f.period, categoryId: f.categoryId, category: f.category, currency: f.currency, budgetMinor: f.budgetMinor, actualMinor: f.actualMinor, varianceMinor: f.varianceMinor };
}

export function periods(): string[] {
  const s = state();
  const set = new Set<string>([...s.txs.map((t) => periodOf(t.date)), ...s.budget.map((b) => b.period)]);
  return [...set].sort().reverse();
}

/** Latest month with recorded transactions: the natural landing period. */
export function latestActualPeriod(): string | null {
  const months = state().txs.map((t) => periodOf(t.date)).sort();
  return months.at(-1) ?? null;
}

export function overview(period: string): OverviewResult {
  const s = state();
  const ids = new Set<string | null>([
    ...s.budget.filter((b) => b.period === period && !b.supersededBy).map((b) => b.categoryId),
    ...s.txs.filter((t) => periodOf(t.date) === period).map((t) => t.categoryId),
  ]);
  const order = (id: string | null) => (id === null ? 999 : s.categories.findIndex((c) => c.id === id));
  const figs = [...ids].sort((a, b) => order(a) - order(b)).map((id) => figure(s, period, id, s.baseCurrency));
  const periodTxs = s.txs.filter((t) => periodOf(t.date) === period && t.currency === s.baseCurrency);
  const cashIn = periodTxs.filter((t) => t.amountMinor > 0n).reduce((x, t) => x + t.amountMinor, 0n);
  const cashOut = periodTxs.filter((t) => t.amountMinor < 0n).reduce((x, t) => x - t.amountMinor, 0n);
  return {
    period,
    currency: s.baseCurrency,
    categories: figs.map(bare),
    cash: { inMinor: ms(cashIn), outMinor: ms(cashOut) },
    openFlags: s.flags.filter((f) => f.status === "open").length,
    contributors: periodTxs.map((t) => contributor(s, t)),
    sourceRefs: [],
    asOf: asOf(s),
  };
}

export function variance(period: string, category: string, currency?: string): VarianceResult | null {
  const s = state();
  const cat = s.categories.find((c) => c.id === category || norm(c.name) === norm(category) || c.aliases.some((a) => norm(a) === norm(category)));
  const id = cat?.id ?? (norm(category) === "uncategorized" ? null : undefined);
  if (id === undefined) return null;
  const { txs, lines, ...f } = figure(s, period, id, currency ?? s.baseCurrency);
  return {
    ...f,
    budgetLineIds: lines.map((l) => l.id),
    contributors: txs.map((t) => contributor(s, t)),
    sourceRefs: txs.map((t) => refFor(s, t)),
    asOf: asOf(s),
  };
}

export function whatChanged(importId?: string): WhatChangedResult {
  const s = state();
  const id = importId ?? asOf(s).importId;
  const ev = s.changes.find((c) => c.importId === id);
  return { importId: id ?? null, deltas: ev?.deltas ?? [], contributors: [], sourceRefs: [], asOf: asOf(s) };
}

export function getAsOf(): AsOf {
  return asOf(state());
}

// ─── Records ────────────────────────────────────────────────────────────────────

export function workspaceMeta() {
  const s = state();
  return { name: s.name, baseCurrency: s.baseCurrency };
}

export function setWorkspaceMeta(input: { name?: string }) {
  const s = state();
  if (input.name) s.name = input.name;
}

export function categories(): Category[] {
  return state().categories;
}

export function setCategoryAliases(id: string, aliases: string[]) {
  const c = state().categories.find((x) => x.id === id);
  if (c) c.aliases = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
}

function txRow(s: State, t: Tx): TransactionRow {
  const { row, file } = fileOfRow(s, t.sourceRowId);
  return {
    id: t.id,
    date: t.date,
    description: t.description,
    counterparty: t.counterparty,
    categoryId: t.categoryId,
    category: t.categoryId ? categoryName(s, t.categoryId) : null,
    amountMinor: ms(t.amountMinor),
    currency: t.currency,
    hasEvidence: hasEvidence(s, t.id),
    flagged: s.flags.some((f) => f.status === "open" && f.entity.type === "transaction" && f.entity.id === t.id),
    source: { fileName: file.name, rowNumber: row.rowNumber },
  };
}

export function transactions(filters: TransactionFilters = {}): TransactionRow[] {
  const s = state();
  const q = norm(filters.query);
  return s.txs
    .filter((t) => !filters.period || periodOf(t.date) === filters.period)
    .filter((t) => !filters.categoryId || t.categoryId === filters.categoryId)
    .map((t) => txRow(s, t))
    .filter((t) => filters.hasEvidence === undefined || t.hasEvidence === filters.hasEvidence)
    .filter((t) => filters.flagged === undefined || t.flagged === filters.flagged)
    .filter((t) => !q || norm(`${t.description} ${t.category}`).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function flagItem(s: State, f: Flag): FlagItem {
  const { fileId, ...rest } = f;
  return { ...rest, fileName: fileId ? s.files.find((x) => x.id === fileId)?.name ?? null : null };
}

export function transaction(id: string): TransactionDetail | null {
  const s = state();
  const t = s.txs.find((x) => x.id === id);
  if (!t) return null;
  const { row } = fileOfRow(s, t.sourceRowId);
  const imp = s.imports.find((i) => i.id === t.importId)!;
  return {
    ...txRow(s, t),
    importId: t.importId,
    headers: imp.headers,
    raw: row.raw,
    documents: s.links
      .filter((l) => l.transactionId === id && l.status === "confirmed")
      .map((l) => {
        const d = s.docs.find((x) => x.id === l.documentId)!;
        return { id: d.id, fileName: s.files.find((f) => f.id === d.fileId)!.name, supplier: d.supplier, totalMinor: d.totalMinor === null ? null : ms(d.totalMinor), currency: d.currency };
      }),
    flags: s.flags.filter((f) => f.entity.type === "transaction" && f.entity.id === id).map((f) => flagItem(s, f)),
  };
}

function docRow(s: State, d: Doc): DocumentRow {
  const file = s.files.find((f) => f.id === d.fileId)!;
  const links = s.links.filter((l) => l.documentId === d.id);
  const confirmed = links.find((l) => l.status === "confirmed");
  const suggested = links.some((l) => l.status === "suggested");
  return {
    id: d.id,
    fileName: file.name,
    supplier: d.supplier,
    date: d.date,
    currency: d.currency,
    totalMinor: d.totalMinor === null ? null : ms(d.totalMinor),
    status: confirmed ? "matched" : suggested ? "needs_review" : "uncertain",
    linkedTransactionId: confirmed?.transactionId ?? null,
    uploadedAt: file.uploadedAt,
    fileUrl: /transportes/i.test(file.name) ? "/samples/bill_transportes_rapidos.pdf" : null,
  };
}

export function documents(): DocumentRow[] {
  const s = state();
  return s.docs.map((d) => docRow(s, d)).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function document(id: string): DocumentDetail | null {
  const s = state();
  const d = s.docs.find((x) => x.id === id);
  if (!d) return null;
  const candidates: MatchCandidate[] = s.links
    .filter((l) => l.documentId === id)
    .map((l) => {
      const t = s.txs.find((x) => x.id === l.transactionId)!;
      return { transactionId: t.id, date: t.date, description: t.description, category: categoryName(s, t.categoryId), amountMinor: ms(t.amountMinor), currency: t.currency, score: l.score, reasons: l.reasons, status: l.status };
    })
    .sort((a, b) => b.score - a.score);
  return { ...docRow(s, d), extractedBy: d.extractedBy, confidence: d.confidence, candidates };
}

export function flags(status?: FlagItem["status"]): FlagItem[] {
  const s = state();
  return s.flags.filter((f) => !status || f.status === status).map((f) => flagItem(s, f)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function setFlagStatus(id: string, status: FlagItem["status"]) {
  const f = state().flags.find((x) => x.id === id);
  if (f) f.status = status;
}

export function imports(): ImportRow[] {
  const s = state();
  return s.imports
    .filter((i) => i.status === "applied")
    .map((i) => ({ id: i.id, fileName: s.files.find((f) => f.id === i.fileId)!.name, type: i.type, counts: i.counts, appliedAt: i.appliedAt }))
    .sort((a, b) => (b.appliedAt ?? "").localeCompare(a.appliedAt ?? ""));
}

export function search(query: string): SearchResult[] {
  const s = state();
  const q = norm(query);
  if (!q) return [];
  const qAmount = /\d/.test(query) && /^[\sq\d.,()-]+$/i.test(query) ? parseAmount(query) : null;
  const qAbs = qAmount === null ? null : abs(qAmount);
  const out: SearchResult[] = [];
  for (const t of s.txs) {
    const text = norm(`${t.description} ${categoryName(s, t.categoryId)}`);
    const amountMatch = qAbs !== null && abs(t.amountMinor) === qAbs;
    if (text.includes(q) || amountMatch) {
      out.push({ kind: "transaction", id: t.id, title: t.description ?? "Transaction", subtitle: `${t.date} · ${categoryName(s, t.categoryId)}`, amountMinor: ms(t.amountMinor), currency: t.currency, href: `/w/${PREVIEW_WS}/transactions/${t.id}` });
    }
  }
  for (const d of s.docs) {
    const name = s.files.find((f) => f.id === d.fileId)!.name;
    const amountMatch = qAbs !== null && d.totalMinor !== null && d.totalMinor === qAbs;
    if (norm(`${name} ${d.supplier}`).includes(q) || amountMatch) {
      out.push({ kind: "document", id: d.id, title: name, subtitle: d.supplier ?? "Needs review", amountMinor: d.totalMinor === null ? undefined : ms(d.totalMinor), currency: d.currency ?? undefined, href: `/w/${PREVIEW_WS}/documents/${d.id}` });
    }
  }
  for (const c of s.categories) {
    if (norm(c.name).includes(q) || c.aliases.some((a) => norm(a).includes(q))) {
      out.push({ kind: "category", id: c.id, title: c.name, subtitle: c.aliases.join(", "), href: `/w/${PREVIEW_WS}/transactions?category=${c.id}` });
    }
  }
  for (const f of s.flags) {
    if (f.status === "open" && norm(`${f.reason} ${f.entity.label} ${f.rule}`).includes(q)) {
      out.push({ kind: "flag", id: f.id, title: f.entity.label, subtitle: f.reason, href: `/w/${PREVIEW_WS}/review` });
    }
  }
  return out.slice(0, 20);
}

// ─── Import flow ────────────────────────────────────────────────────────────────

export async function proposeImport(fileName: string, text: string): Promise<ImportPreview> {
  const s = state();
  const sha = await sha256(text);
  const existing = s.files.find((f) => f.sha === sha);
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data;
  const proposal = proposeByHeuristics({ workspaceId: PREVIEW_WS, importId: "preview", headers, sampleRows: rows.slice(0, 5) });
  if (existing) {
    const imp = s.imports.find((i) => i.fileId === existing.id);
    return { importId: imp?.id ?? "", fileName, alreadyImported: true, proposal, headers, sampleRows: rows.slice(0, 5), rowCount: rows.length };
  }
  const file: SourceFile = { id: nextId(s), name: fileName, kind: proposal.type === "budget" ? "csv_budget" : "csv_actual", sha, uploadedAt: new Date().toISOString() };
  s.files.push(file);
  const imp: Import = { id: nextId(s), fileId: file.id, type: proposal.type, status: "proposed", proposal, counts: null, appliedAt: null, headers, rows };
  s.imports.push(imp);
  return { importId: imp.id, fileName, alreadyImported: false, proposal, headers, sampleRows: rows.slice(0, 5), rowCount: rows.length };
}

type FigureKey = string;
const keyOf = (period: string, categoryId: string | null, currency: string): FigureKey => `${period}|${categoryId ?? ""}|${currency}`;

export function applyImport(importId: string, mapping: MappingProposal): ApplyResult {
  const s = state();
  const imp = s.imports.find((i) => i.id === importId && i.status === "proposed");
  if (!imp) throw new Error("Import not found or already applied.");
  const file = s.files.find((f) => f.id === imp.fileId)!;
  file.kind = mapping.type === "budget" ? "csv_budget" : "csv_actual";
  imp.type = mapping.type;
  const col = (f: keyof MappingProposal["fields"]) => mapping.fields[f]?.column;
  const counts: ImportCounts = { new: 0, repeat: 0, flagged: 0 };
  const touched = new Set<FigureKey>();
  const before = new Map<FigureKey, VarianceFigure>();
  const snapshot = (period: string, categoryId: string | null, currency: string) => {
    const k = keyOf(period, categoryId, currency);
    if (!before.has(k)) {
      before.set(k, bare(figure(s, period, categoryId, currency)));
    }
    touched.add(k);
  };
  const occurrences = new Map<string, number>();

  imp.rows.forEach((raw, i) => {
    const rowNumber = i + 2;
    const row: SourceRow = { id: nextId(s), fileId: file.id, rowNumber, raw };
    s.rows.push(row);
    const amountCol = col("amount");
    const amount = amountCol ? parseAmount(raw[amountCol] ?? "") : null;
    const currency = (col("currency") && raw[col("currency")!]?.trim().toUpperCase()) || s.baseCurrency;
    const rawCat = col("category") ? raw[col("category")!] ?? "" : "";
    const categoryId = resolveCategoryId(s, rawCat);
    const flag = (column: string | undefined, reason: string) => {
      counts.flagged += 1;
      s.flags.push({ id: nextId(s), rule: "parse_error", severity: "error", reason, fileId: file.id, rowNumber, column: column ?? null, entity: { type: "source_row", id: row.id, label: `${file.name} · row ${rowNumber}` }, status: "open", createdAt: new Date().toISOString() });
    };
    if (amount === null) return flag(amountCol, `Amount “${raw[amountCol ?? ""] ?? ""}” can't be read as money.`);

    if (mapping.type === "actual") {
      const date = col("date") ? parseDate(raw[col("date")!] ?? "") : null;
      if (!date) return flag(col("date"), `Date “${raw[col("date") ?? ""] ?? ""}” isn't a valid date.`);
      const description = col("description") ? raw[col("description")!] ?? null : null;
      const base = fingerprint(date, amount, currency, description, rawCat, 0);
      const occ = occurrences.get(base) ?? 0;
      occurrences.set(base, occ + 1);
      const fp = fingerprint(date, amount, currency, description, rawCat, occ);
      if (s.txs.some((t) => t.fingerprint === fp)) {
        counts.repeat += 1;
        return;
      }
      snapshot(periodOf(date), categoryId, currency);
      const tx: Tx = { id: nextId(s), date, amountMinor: amount, currency, categoryId, description, counterparty: col("counterparty") ? raw[col("counterparty")!] ?? null : counterpartyOf(description), fingerprint: fp, sourceRowId: row.id, importId: imp.id };
      s.txs.push(tx);
      counts.new += 1;
      if (!categoryId) {
        s.flags.push({ id: nextId(s), rule: "unmapped_category", severity: "warning", reason: `Category “${rawCat}” isn't one of your categories yet.`, fileId: file.id, rowNumber, column: col("category") ?? null, entity: { type: "transaction", id: tx.id, label: `${description ?? "Transaction"}` }, status: "open", createdAt: new Date().toISOString() });
      }
      if (currency !== s.baseCurrency) {
        s.flags.push({ id: nextId(s), rule: "currency_mismatch", severity: "warning", reason: `Row is in ${currency}, workspace is ${s.baseCurrency}. Shown separately, never summed.`, fileId: file.id, rowNumber, column: col("currency") ?? null, entity: { type: "transaction", id: tx.id, label: `${description ?? "Transaction"}` }, status: "open", createdAt: new Date().toISOString() });
      }
    } else {
      const period = col("period") ? (raw[col("period")!] ?? "").trim() : "";
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return flag(col("period"), `Period “${period}” must look like YYYY-MM.`);
      if (!categoryId) return flag(col("category"), `Category “${rawCat}” isn't one of your categories yet.`);
      snapshot(period, categoryId, currency);
      const line: BudgetLine = { id: nextId(s), period, categoryId, currency, amountMinor: amount < 0n ? -amount : amount, sourceRowId: row.id, importId: imp.id, supersededBy: null };
      const active = s.budget.find((b) => b.period === period && b.categoryId === categoryId && b.currency === currency && !b.supersededBy);
      if (active && active.amountMinor === line.amountMinor) {
        counts.repeat += 1;
        return;
      }
      if (active) active.supersededBy = line.id;
      s.budget.push(line);
      counts.new += 1;
    }
  });

  const deltas: WhatChangedDelta[] = [];
  for (const k of touched) {
    const [period, categoryId, currency] = k.split("|") as [string, string, string];
    const b = before.get(k)!;
    const a = bare(figure(s, period, categoryId || null, currency));
    for (const field of ["actual", "budget", "variance"] as const) {
      const bm = b[`${field}Minor`];
      const am = a[`${field}Minor`];
      if (bm !== am) deltas.push({ period, category: a.category, currency, field, beforeMinor: bm, afterMinor: am });
    }
  }

  imp.status = "applied";
  imp.counts = counts;
  imp.appliedAt = new Date().toISOString();
  imp.proposal = mapping;
  s.changes.push({ importId: imp.id, deltas });
  return { importId: imp.id, counts, changed: whatChanged(imp.id) };
}

// ─── Documents ──────────────────────────────────────────────────────────────────

function suggestFor(s: State, d: Doc) {
  s.links = s.links.filter((l) => !(l.documentId === d.id && l.status === "suggested"));
  const taken = new Set(s.links.filter((l) => l.status === "confirmed").map((l) => l.transactionId));
  const rejected = new Set(s.links.filter((l) => l.documentId === d.id && l.status === "rejected").map((l) => l.transactionId));
  const scored = s.txs
    .filter((t) => !taken.has(t.id) && !rejected.has(t.id))
    .map((t) => scoreMatch({ id: d.id, supplier: d.supplier, docDate: d.date, currency: d.currency, totalMinor: d.totalMinor }, { id: t.id, date: t.date, amountMinor: t.amountMinor, currency: t.currency, description: t.description, counterparty: t.counterparty }))
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  for (const m of scored) s.links.push({ documentId: d.id, transactionId: m.transaction_id, status: "suggested", score: m.score, reasons: m.reasons });
  s.flags = s.flags.filter((f) => !(f.rule === "uncertain_match" && f.entity.id === d.id && f.status === "open"));
  const fileName = s.files.find((f) => f.id === d.fileId)!.name;
  if (scored.length === 0 && !s.links.some((l) => l.documentId === d.id && l.status === "confirmed") && d.totalMinor !== null) {
    s.flags.push({ id: nextId(s), rule: "uncertain_match", severity: "info", reason: "No transaction matches this bill's amount and date yet.", fileId: d.fileId, rowNumber: null, column: null, entity: { type: "document", id: d.id, label: fileName }, status: "open", createdAt: new Date().toISOString() });
  }
}

export async function uploadDocument(fileName: string, bytes: ArrayBuffer, aiEnabled: boolean): Promise<{ documentId: string; alreadyImported: boolean }> {
  const s = state();
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  const sha = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const existing = s.files.find((f) => f.sha === sha);
  if (existing) {
    const d = s.docs.find((x) => x.fileId === existing.id);
    if (d) return { documentId: d.id, alreadyImported: true };
  }
  const file: SourceFile = { id: nextId(s), name: fileName, kind: "pdf", sha, uploadedAt: new Date().toISOString() };
  s.files.push(file);
  const sample = SAMPLE_EXTRACTIONS.find((x) => x.match.test(fileName));
  const doc: Doc = sample
    ? { id: nextId(s), fileId: file.id, supplier: sample.supplier, date: sample.date, currency: sample.currency, totalMinor: sample.totalMinor, extractedBy: aiEnabled ? "ai" : "sample", confidence: { supplier: 0.96, date: 0.98, currency: 0.99, total: 0.99 } }
    : { id: nextId(s), fileId: file.id, supplier: null, date: null, currency: s.baseCurrency, totalMinor: null, extractedBy: "manual", confidence: null };
  s.docs.push(doc);
  suggestFor(s, doc);
  return { documentId: doc.id, alreadyImported: false };
}

export function saveDocumentFields(id: string, fields: { supplier?: string; date?: string; currency?: string; totalMinor?: string }) {
  const s = state();
  const d = s.docs.find((x) => x.id === id);
  if (!d) return;
  if (fields.supplier !== undefined) d.supplier = fields.supplier || null;
  if (fields.date !== undefined) d.date = fields.date || null;
  if (fields.currency !== undefined) d.currency = fields.currency || null;
  if (fields.totalMinor !== undefined) d.totalMinor = fields.totalMinor ? BigInt(fields.totalMinor) : null;
  if (d.extractedBy !== "manual") d.extractedBy = "manual";
  suggestFor(s, d);
}

export function confirmMatch(documentId: string, transactionId: string) {
  const s = state();
  for (const l of s.links) {
    if (l.documentId === documentId && l.status === "confirmed") l.status = "suggested";
  }
  const link = s.links.find((l) => l.documentId === documentId && l.transactionId === transactionId);
  if (link) link.status = "confirmed";
  else s.links.push({ documentId, transactionId, status: "confirmed", score: 1, reasons: [] });
  s.links = s.links.filter((l) => !(l.documentId === documentId && l.status === "suggested"));
  s.flags = s.flags.filter((f) => !(f.rule === "uncertain_match" && f.entity.id === documentId));
  for (const f of s.flags) {
    if (f.rule === "missing_evidence" && f.entity.id === transactionId && f.status === "open") f.status = "resolved";
  }
}

export function unconfirmMatch(documentId: string, transactionId: string) {
  const s = state();
  const link = s.links.find((l) => l.documentId === documentId && l.transactionId === transactionId);
  if (link) link.status = "suggested";
}

export function rejectMatch(documentId: string, transactionId: string) {
  const s = state();
  const link = s.links.find((l) => l.documentId === documentId && l.transactionId === transactionId);
  if (link) link.status = "rejected";
  const d = s.docs.find((x) => x.id === documentId);
  if (d && !s.links.some((l) => l.documentId === documentId && (l.status === "suggested" || l.status === "confirmed"))) {
    const fileName = s.files.find((f) => f.id === d.fileId)!.name;
    s.flags.push({ id: nextId(s), rule: "uncertain_match", severity: "info", reason: "You rejected every suggestion. Edit the fields or link a transaction manually.", fileId: d.fileId, rowNumber: null, column: null, entity: { type: "document", id: d.id, label: fileName }, status: "open", createdAt: new Date().toISOString() });
  }
}
