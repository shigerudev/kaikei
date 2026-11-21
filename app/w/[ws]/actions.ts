"use server";
/**
 * Server actions for screens (owner: Jordi). Thin wrappers over lib/data mutations; every action
 * refreshes the router so figures re-render from the data source (never patched client-side).
 */
import { refresh } from "next/cache";
import { NotImplementedError } from "@/lib/not-implemented";
import * as data from "@/lib/data";
import type { FlagItem, ImportPreview } from "@/lib/data/types";
import { MappingProposal } from "@/lib/types";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>, doRefresh = true): Promise<Result<T>> {
  try {
    const out = await fn();
    if (doRefresh) refresh();
    return { ok: true, data: out };
  } catch (err) {
    if (err instanceof NotImplementedError) return { ok: false, error: `${err.what} isn't built yet (${err.owner}).` };
    console.error("[action]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function proposeImportAction(ws: string, form: FormData): Promise<Result<ImportPreview>> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a CSV file first." };
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") return { ok: false, error: "That isn't a CSV. Export your spreadsheet as .csv and try again." };
  if (file.size > MAX_CSV_BYTES) return { ok: false, error: "That file is over 2 MB. Split it by month and import each part." };
  const text = await file.text();
  return run(() => data.proposeImport(ws, file.name, text), false);
}

export async function applyImportAction(ws: string, importId: string, mapping: unknown) {
  const parsed = MappingProposal.safeParse(mapping);
  if (!parsed.success) return { ok: false as const, error: "The mapping is incomplete." };
  return run(() => data.applyImport(ws, importId, parsed.data));
}

export async function uploadDocumentAction(ws: string, form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "Choose a PDF first." };
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return { ok: false as const, error: "Bills must be PDFs." };
  if (file.size > MAX_PDF_BYTES) return { ok: false as const, error: "That PDF is over 10 MB." };
  const bytes = await file.arrayBuffer();
  return run(() => data.uploadDocument(ws, file.name, bytes));
}

export async function saveDocumentFieldsAction(ws: string, id: string, fields: { supplier?: string; date?: string; currency?: string; totalMinor?: string }) {
  if (fields.totalMinor !== undefined && fields.totalMinor !== "" && !/^\d+$/.test(fields.totalMinor)) return { ok: false as const, error: "Total must be a positive amount." };
  if (fields.date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) return { ok: false as const, error: "Date must be YYYY-MM-DD." };
  return run(() => data.saveDocumentFields(ws, id, fields));
}

export async function matchAction(ws: string, documentId: string, transactionId: string, action: "confirm" | "reject" | "undo") {
  return run(() => data.setMatch(ws, documentId, transactionId, action));
}

export async function flagAction(ws: string, id: string, status: FlagItem["status"]) {
  return run(() => data.setFlagStatus(ws, id, status));
}

export async function updateWorkspaceAction(ws: string, input: { name: string }) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Name can't be empty." };
  return run(() => data.updateWorkspace(ws, { name }));
}

export async function updateAliasesAction(ws: string, categoryId: string, aliases: string[]) {
  return run(() => data.updateCategoryAliases(ws, categoryId, aliases));
}

export async function resetSampleAction(ws: string) {
  return run(() => data.resetSample(ws));
}
