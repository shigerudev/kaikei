import "server-only";
/**
 * The UI's only data source (owner: Jordi; SCOPE §1.4 `lib/api/`).
 *
 * KAIKEI_API_URL set   → the FastAPI engine (MANIFESTO §4.4). Paths follow the contract; response
 *                        shapes are the hand-written types in ./types until the OpenAPI client is generated.
 * KAIKEI_API_URL unset → preview: ./preview/store serves a snapshot built from fixtures/grupo-ag and
 *                        every screen shows a "Preview data" badge. Nothing here computes a figure.
 */
import * as preview from "./preview/store";
import type {
  Company,
  DataSource,
  Facts,
  FilePreview,
  Finding,
  FindingDecision,
  Group,
  Journal,
  Lineage,
  MatchGroup,
  Parameter,
  RateSet,
  Run,
  SearchHit,
  SourceFile,
} from "./types";

export * from "./types";

const BASE = process.env.KAIKEI_API_URL?.replace(/\/$/, "");

export function dataSource(): DataSource {
  return BASE ? "engine" : "preview";
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, { ...init, cache: "no-store", headers: { accept: "application/json", ...init?.headers } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(body || res.statusText, res.status, path);
  }
  return (await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

// ─── Group config ───────────────────────────────────────────────────────────────

export async function getGroup(groupId: string): Promise<Group | null> {
  if (!BASE) return groupId === preview.PREVIEW_GROUP ? preview.group() : null;
  return api<Group>(`/groups/${groupId}`).catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e)));
}

export async function getCompanies(groupId: string): Promise<Company[]> {
  if (!BASE) return preview.companies();
  return api<Company[]>(`/groups/${groupId}/companies`);
}

export async function getRateSet(groupId: string): Promise<RateSet> {
  if (!BASE) return preview.rateSet();
  return api<RateSet>(`/groups/${groupId}/fx-rate-sets/current`);
}

export async function getParameters(groupId: string): Promise<Parameter[]> {
  if (!BASE) return preview.parameters();
  return api<Parameter[]>(`/groups/${groupId}/parameters`);
}

// ─── Files & mappings ───────────────────────────────────────────────────────────

export async function getFiles(groupId: string): Promise<SourceFile[]> {
  if (!BASE) return preview.files();
  return api<SourceFile[]>(`/files?group_id=${groupId}`);
}

export async function getFilePreview(fileId: string): Promise<FilePreview | null> {
  if (!BASE) return preview.preview(fileId);
  return api<FilePreview>(`/files/${fileId}/preview`);
}

export async function uploadFile(groupId: string, file: File): Promise<{ file: SourceFile; alreadyImported: boolean }> {
  if (!BASE) return preview.upload(file.name, await file.arrayBuffer());
  const form = new FormData();
  form.set("group_id", groupId);
  form.set("file", file);
  return api(`/files`, { method: "POST", body: form });
}

export async function approveMapping(groupId: string, companyId: string): Promise<void> {
  if (!BASE) return preview.approveMapping(companyId);
  await api(`/mappings/${groupId}:${companyId}/approve`, { method: "POST" });
}

// ─── Runs ───────────────────────────────────────────────────────────────────────

export async function getRuns(groupId: string): Promise<Run[]> {
  if (!BASE) return preview.runs();
  return api<Run[]>(`/consolidations?group_id=${groupId}`);
}

/** A specific run, or the latest one when `runId` is omitted. */
export async function getRun(groupId: string, runId?: string): Promise<Run | null> {
  if (!BASE) return preview.run(runId);
  if (!runId) return (await getRuns(groupId))[0] ?? null;
  return api<Run>(`/consolidations/${runId}`);
}

export async function startRun(groupId: string, reason: string): Promise<Run> {
  if (!BASE) return preview.startRun(reason);
  return api<Run>(`/consolidations`, json({ group_id: groupId, reason }));
}

export async function publishRun(runId: string): Promise<Run> {
  if (!BASE) return preview.publish(runId);
  return api<Run>(`/consolidations/${runId}/publish`, { method: "POST" });
}

// ─── Results ────────────────────────────────────────────────────────────────────

export async function getFacts(runId: string, period: string, statement: "PL" | "BS"): Promise<Facts | null> {
  if (!BASE) return preview.facts(runId, period, statement);
  return api<Facts>(`/consolidations/${runId}/facts?period=${period}&statement=${statement}`);
}

export async function getLineage(factId: string): Promise<Lineage | null> {
  if (!BASE) return preview.lineage(factId);
  return api<Lineage>(`/facts/${factId}/lineage`);
}

export async function getReconciliations(runId: string): Promise<{ matches: MatchGroup[]; journals: Journal[] }> {
  if (!BASE) return { matches: preview.matches(), journals: preview.journals() };
  return api(`/consolidations/${runId}/reconciliations`);
}

export async function getFindings(runId: string): Promise<Finding[]> {
  if (!BASE) return preview.findings();
  return api<Finding[]>(`/consolidations/${runId}/findings`);
}

export async function getFinding(runId: string, findingId: string): Promise<Finding | null> {
  if (!BASE) return preview.finding(findingId);
  return (await getFindings(runId)).find((f) => f.id === findingId) ?? null;
}

export async function decideFinding(findingId: string, action: FindingDecision["action"], reason: string, actor: string): Promise<Run> {
  if (!BASE) return preview.decide(findingId, action, reason, actor);
  return api<Run>(`/findings/${findingId}/decisions`, json({ action, reason, actor }));
}

export async function search(groupId: string, q: string): Promise<SearchHit[]> {
  if (!BASE) return preview.search(q);
  return api<SearchHit[]>(`/groups/${groupId}/search?q=${encodeURIComponent(q)}`).catch(() => []);
}

export async function resetPreview(mode: "full" | "empty") {
  if (BASE) throw new ApiError("Reset is only available in preview.", 400, "reset");
  preview.reset(mode);
}
