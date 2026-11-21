import "server-only";
/**
 * The only data entry point for screens (owner: Jordi).
 *
 * DATA_SOURCE=preview (default until Jose's metrics land) → lib/preview, an in-memory stand-in with the
 * same contracts; every screen shows a "Preview data" badge so no number passes as real.
 * DATA_SOURCE=db → lib/metrics (figures) + DB reads. Reads that don't exist yet throw
 * NotImplementedError, which screens render as a friendly "not built yet" state.
 */
import { NotImplementedError } from "@/lib/not-implemented";
import * as preview from "@/lib/preview/store";
import { PREVIEW_WS } from "@/lib/preview/seed";
import type { MappingProposal } from "@/lib/types";
import type {
  ApplyResult,
  Category,
  DataSource,
  DocumentDetail,
  DocumentRow,
  FlagItem,
  ImportPreview,
  ImportRow,
  OverviewResult,
  SearchResult,
  TransactionDetail,
  TransactionFilters,
  TransactionRow,
  VarianceResult,
  WhatChangedResult,
  WorkspaceInfo,
} from "./types";

export function dataSource(): DataSource {
  return process.env.DATA_SOURCE === "db" ? "db" : "preview";
}

const isPreview = () => dataSource() === "preview";
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const aiEnabled = () => process.env.AI_ENABLED === "true";

function todo(what: string, owner = "Jose"): never {
  throw new NotImplementedError(what, owner);
}

async function metrics() {
  return import("@/lib/metrics");
}

// ─── Workspace ──────────────────────────────────────────────────────────────────

export async function getWorkspaceInfo(ws: string): Promise<WorkspaceInfo | null> {
  if (isPreview()) {
    if (ws !== PREVIEW_WS) return null;
    const meta = preview.workspaceMeta();
    return { id: ws, ...meta, isSample: true, mcpUrl: `${appUrl()}/api/mcp/preview-token`, aiEnabled: aiEnabled(), dataSource: "preview" };
  }
  const { getWorkspace } = await import("@/lib/workspaces");
  const row = await getWorkspace(ws);
  if (!row) return null;
  return { id: row.id, name: row.name, baseCurrency: row.baseCurrency, isSample: row.isSample, mcpUrl: `${appUrl()}/api/mcp/${row.mcpToken}`, aiEnabled: aiEnabled(), dataSource: "db" };
}

export async function listWorkspaces(): Promise<{ id: string; name: string }[]> {
  if (isPreview()) return [{ id: PREVIEW_WS, name: preview.workspaceMeta().name }];
  return todo("data.listWorkspaces");
}

export async function getCategories(ws: string): Promise<Category[]> {
  void ws;
  if (isPreview()) return preview.categories();
  return todo("data.getCategories");
}

/** Periods with data, latest first. */
export async function getPeriods(ws: string): Promise<string[]> {
  void ws;
  if (isPreview()) return preview.periods();
  return todo("data.getPeriods");
}

/** Latest month with recorded transactions, so a future budget-only month isn't the landing view. */
export async function getDefaultPeriod(ws: string): Promise<string | null> {
  void ws;
  if (isPreview()) return preview.latestActualPeriod();
  return todo("data.getDefaultPeriod");
}

export async function resolvePeriod(ws: string, requested?: string | string[]): Promise<{ period: string; periods: string[] }> {
  const [periods, latest] = await Promise.all([getPeriods(ws).catch(() => [] as string[]), getDefaultPeriod(ws).catch(() => null)]);
  const want = typeof requested === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : undefined;
  return { period: want ?? latest ?? periods[0] ?? "2026-11", periods };
}

// ─── Figures (K3) ───────────────────────────────────────────────────────────────

export async function getOverview(ws: string, period: string): Promise<OverviewResult> {
  if (isPreview()) return preview.overview(period);
  return (await metrics()).getOverview(ws, period);
}

export async function getVariance(ws: string, period: string, category: string, currency?: string): Promise<VarianceResult | null> {
  if (isPreview()) return preview.variance(period, category, currency);
  return (await metrics()).getVariance(ws, period, category, currency);
}

export async function getWhatChanged(ws: string, importId?: string): Promise<WhatChangedResult> {
  if (isPreview()) return preview.whatChanged(importId);
  return (await metrics()).whatChanged(ws, importId);
}

export async function getAsOf(ws: string) {
  if (isPreview()) return preview.getAsOf();
  return (await metrics()).getAsOf(ws);
}

// ─── Records ────────────────────────────────────────────────────────────────────

export async function getTransactions(ws: string, filters: TransactionFilters = {}): Promise<TransactionRow[]> {
  void ws;
  if (isPreview()) return preview.transactions(filters);
  return todo("data.getTransactions");
}

export async function getTransaction(ws: string, id: string): Promise<TransactionDetail | null> {
  void ws;
  if (isPreview()) return preview.transaction(id);
  return todo("data.getTransaction");
}

export async function getDocuments(ws: string): Promise<DocumentRow[]> {
  void ws;
  if (isPreview()) return preview.documents();
  return todo("data.getDocuments", "Hugo");
}

export async function getDocument(ws: string, id: string): Promise<DocumentDetail | null> {
  void ws;
  if (isPreview()) return preview.document(id);
  return todo("data.getDocument", "Hugo");
}

export async function getFlags(ws: string, status?: FlagItem["status"]): Promise<FlagItem[]> {
  if (isPreview()) return preview.flags(status);
  const { listFlags } = await import("@/lib/flags");
  return (await listFlags(ws, status)) as FlagItem[];
}

export async function getImports(ws: string): Promise<ImportRow[]> {
  void ws;
  if (isPreview()) return preview.imports();
  return todo("data.getImports");
}

export async function search(ws: string, q: string): Promise<SearchResult[]> {
  void ws;
  if (isPreview()) return preview.search(q);
  return todo("data.search");
}

// ─── Mutations (called only from server actions) ────────────────────────────────

export async function proposeImport(ws: string, fileName: string, text: string): Promise<ImportPreview> {
  void ws;
  if (isPreview()) return preview.proposeImport(fileName, text);
  return todo("data.proposeImport");
}

export async function applyImport(ws: string, importId: string, mapping: MappingProposal): Promise<ApplyResult> {
  void ws;
  if (isPreview()) return preview.applyImport(importId, mapping);
  return todo("data.applyImport");
}

export async function uploadDocument(ws: string, fileName: string, bytes: ArrayBuffer) {
  void ws;
  if (isPreview()) return preview.uploadDocument(fileName, bytes, aiEnabled());
  return todo("data.uploadDocument", "Hugo");
}

export async function saveDocumentFields(ws: string, id: string, fields: Parameters<typeof preview.saveDocumentFields>[1]) {
  void ws;
  if (isPreview()) return preview.saveDocumentFields(id, fields);
  return todo("data.saveDocumentFields", "Hugo");
}

export async function setMatch(ws: string, documentId: string, transactionId: string, action: "confirm" | "reject" | "undo") {
  if (isPreview()) {
    if (action === "confirm") return preview.confirmMatch(documentId, transactionId);
    if (action === "reject") return preview.rejectMatch(documentId, transactionId);
    return preview.unconfirmMatch(documentId, transactionId);
  }
  const m = await import("@/lib/documents/match");
  if (action === "confirm") return m.confirmMatch({ workspaceId: ws, documentId, transactionId });
  if (action === "reject") return m.rejectMatch({ workspaceId: ws, documentId, transactionId });
  return todo("data.unconfirmMatch", "Hugo");
}

export async function setFlagStatus(ws: string, id: string, status: FlagItem["status"]) {
  if (isPreview()) return preview.setFlagStatus(id, status);
  const { setFlagStatus: set } = await import("@/lib/flags");
  if (status === "open") return todo("flags.reopen", "Deyane");
  return set(ws, id, status);
}

export async function updateWorkspace(ws: string, input: { name?: string }) {
  void ws;
  if (isPreview()) return preview.setWorkspaceMeta(input);
  return todo("data.updateWorkspace", "Antonio");
}

export async function updateCategoryAliases(ws: string, id: string, aliases: string[]) {
  void ws;
  if (isPreview()) return preview.setCategoryAliases(id, aliases);
  return todo("data.updateCategoryAliases");
}

export async function resetSample(ws: string) {
  void ws;
  if (isPreview()) return preview.resetPreview();
  return todo("data.resetSample", "Jose + Antonio");
}
