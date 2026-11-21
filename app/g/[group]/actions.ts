"use server";
/**
 * Server actions for group screens (owner: Jordi). Thin wrappers over lib/api; every mutation refreshes
 * the router so results re-render from the API (never patched client-side).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { refresh } from "next/cache";
import * as api from "@/lib/api";
import type { FindingDecision, Run, SearchHit } from "@/lib/api/types";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (err) {
    console.error("[action]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

const MAX_BYTES = 20 * 1024 * 1024;
const ACTOR = "Reviewer";

export async function searchAction(group: string, q: string): Promise<SearchHit[]> {
  return api.search(group, q.slice(0, 100));
}

export async function uploadAction(group: string, form: FormData) {
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return { ok: false as const, error: "Choose at least one file." };
  const bad = files.find((f) => !/\.(csv|xlsx)$/i.test(f.name));
  if (bad) return { ok: false as const, error: `${bad.name} isn't a CSV or XLSX file.` };
  if (files.some((f) => f.size > MAX_BYTES)) return { ok: false as const, error: "Files must be under 20 MB." };
  return run(async () => {
    const out = [];
    for (const f of files) out.push(await api.uploadFile(group, f));
    return out.map((o) => ({ company_id: o.file.company_id, filename: o.file.filename, alreadyImported: o.alreadyImported }));
  });
}

/** Preview only: feed the six fixture packs through the same upload path. */
export async function loadSamplePacksAction(group: string) {
  if (api.dataSource() !== "preview") return { ok: false as const, error: "Sample packs are only available in preview." };
  return run(async () => {
    const companies = await api.getCompanies(group);
    for (const c of companies) {
      const bytes = await readFile(path.join(process.cwd(), "fixtures", "grupo-ag", c.filename));
      await api.uploadFile(group, new File([bytes], c.filename, { type: "text/csv" }));
    }
    return companies.length;
  });
}

export async function approveMappingAction(group: string, companyId: string) {
  return run(() => api.approveMapping(group, companyId));
}

export async function startRunAction(group: string, reason: string): Promise<Result<Run>> {
  return run(() => api.startRun(group, reason.trim() || "Manual rerun"));
}

export async function decideAction(findingId: string, action: FindingDecision["action"], reason: string): Promise<Result<Run>> {
  if (!reason.trim()) return { ok: false, error: "Add a reason so the decision is auditable." };
  return run(() => api.decideFinding(findingId, action, reason, ACTOR));
}

export async function publishAction(runId: string): Promise<Result<Run>> {
  return run(() => api.publishRun(runId));
}

export async function resetPreviewAction(mode: "full" | "empty") {
  return run(() => api.resetPreview(mode));
}
