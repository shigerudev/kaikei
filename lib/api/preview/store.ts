import "server-only";
/**
 * Preview stand-in for the engine API (owner: Jordi). Serves snapshot.json (built from the fixture pack by
 * build_snapshot.py) and keeps the few mutable bits in memory: uploads, mapping approvals, finding
 * decisions and runs. It follows the engine's rules on purpose — decisions create new runs, open
 * BLOCKERs keep a run BLOCKED, the same inputs give the same fingerprint — but it is not the engine.
 */
import { createHash } from "node:crypto";
import raw from "./snapshot.json";
import type {
  Company,
  Facts,
  FilePreview,
  Finding,
  FindingDecision,
  FindingStatus,
  Group,
  Journal,
  Lineage,
  MatchGroup,
  Parameter,
  RateSet,
  Run,
  RunStage,
  SearchHit,
  SourceFile,
} from "../types";

type Snapshot = {
  group: Group;
  companies: Company[];
  rate_set: RateSet;
  parameters: Parameter[];
  files: SourceFile[];
  previews: Record<string, FilePreview>;
  facts: Record<string, Facts["rows"]>;
  lineage: Record<string, Lineage>;
  matches: MatchGroup[];
  journals: Journal[];
  findings: Finding[];
  run_inputs: Omit<Run["inputs"], "decisions">;
  counts: Omit<Run["counts"], "findings_open" | "blockers_open">;
};

const snap = raw as unknown as Snapshot;
export const PREVIEW_GROUP = snap.group.id;

type State = {
  files: SourceFile[];
  findings: Map<string, { status: FindingStatus; decisions: FindingDecision[] }>;
  runs: Run[];
  seq: number;
};

const g = globalThis as unknown as { __kaikeiApiPreview?: State };

function fresh(mode: "full" | "empty" = "full"): State {
  const s: State = {
    files: snap.files.map((f) => (mode === "full" ? { ...f } : { ...f, status: "MISSING", sha256: null, uploaded_at: null, rows: null, records: null, parse_warnings: [], mapping_version: null })),
    findings: new Map(snap.findings.map((f) => [f.id, { status: "OPEN", decisions: [] }])),
    runs: [],
    seq: 0,
  };
  if (mode === "full") createRun(s, null, "Initial run on the six packs", "2026-11-21T15:20:00.000Z");
  return s;
}

function state(): State {
  g.__kaikeiApiPreview ??= fresh();
  return g.__kaikeiApiPreview;
}

export function reset(mode: "full" | "empty") {
  g.__kaikeiApiPreview = fresh(mode);
}

// ─── Runs ───────────────────────────────────────────────────────────────────────

const OPEN: FindingStatus[] = ["OPEN", "UNDER_REVIEW"];

function decisionsDigest(s: State) {
  return [...s.findings.entries()]
    .filter(([, v]) => v.decisions.length)
    .map(([id, v]) => `${id}:${v.status}`)
    .sort();
}

function fingerprint(s: State) {
  const files = s.files.filter((f) => f.status === "MAPPING_APPROVED").map((f) => `${f.company_id}:${f.sha256}`).sort();
  const parts = [...files, snap.run_inputs.mapping_version, snap.run_inputs.rate_set_id, snap.run_inputs.rule_set_version, ...decisionsDigest(s)];
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

function stages(open: Finding[]): RunStage[] {
  const c = snap.counts;
  const by = (rule: string[]) => open.filter((f) => rule.includes(f.rule_id));
  const blocked = (rule: string[]) => by(rule).some((f) => f.severity === "BLOCKER");
  const warn = (rule: string[]) => by(rule).length > 0;
  const st = (rule: string[]): RunStage["status"] => (blocked(rule) ? "blocked" : warn(rule) ? "warning" : "done");
  return [
    { key: "ingest", label: "Ingest", status: "done", detail: `6 files stored with SHA-256 · ${c.records} rows extracted with their cells` },
    { key: "normalize", label: "Normalize", status: st(["VAL-003"]), detail: `${c.records - c.held_back} canonical records · mapping MAP-V1` },
    { key: "validate", label: "Validate", status: st(["VAL-006", "VAL-010", "VAL-019", "VAL-020", "VAL-021", "VAL-022", "VAL-023", "VAL-024"]), detail: `${open.length} open findings · ${open.filter((f) => f.severity === "BLOCKER").length} blockers` },
    { key: "translate", label: "Translate", status: "done", detail: `${c.translated} records to USD · rate set FX-BUDGET-2027-V1` },
    { key: "match", label: "Match IC", status: st(["VAL-007", "VAL-008"]), detail: `${c.matched} matched · ${c.mismatched} mismatch · ${c.one_sided} one-sided` },
    { key: "eliminate", label: "Eliminate", status: "done", detail: `${c.journals} balanced journals` },
    { key: "aggregate", label: "Aggregate", status: open.some((f) => f.severity === "BLOCKER") ? "blocked" : "done", detail: "Facts = contributions + adjustments" },
  ];
}

function createRun(s: State, parent: string | null, reason: string, at = new Date().toISOString()): Run {
  const open = currentFindings(s).filter((f) => OPEN.includes(f.status));
  const blockers = open.filter((f) => f.severity === "BLOCKER").length;
  s.seq += 1;
  const run: Run = {
    id: `RUN-${String(s.seq).padStart(3, "0")}`,
    number: s.seq,
    status: blockers ? "BLOCKED" : "READY_FOR_REVIEW",
    fingerprint: fingerprint(s),
    scenario: snap.group.scenario,
    created_at: at,
    parent_run_id: parent,
    reason,
    inputs: { ...snap.run_inputs, decisions: decisionsDigest(s) },
    stages: stages(open),
    counts: { ...snap.counts, findings_open: open.length, blockers_open: blockers },
  };
  s.runs.unshift(run);
  return run;
}

function currentFindings(s: State): Finding[] {
  return snap.findings.map((f) => {
    const st = s.findings.get(f.id)!;
    return { ...f, status: st.status, decisions: st.decisions };
  });
}

// ─── Reads ──────────────────────────────────────────────────────────────────────

export const group = () => snap.group;
export const companies = () => snap.companies;
export const rateSet = () => snap.rate_set;
export const parameters = () => snap.parameters;
export const files = () => state().files;
export const preview = (fileId: string) => {
  const f = state().files.find((x) => x.id === fileId);
  return f && f.status !== "MISSING" ? snap.previews[f.company_id] ?? null : null;
};
export const runs = () => state().runs;
export const run = (id?: string) => (id ? state().runs.find((r) => r.id === id) : state().runs[0]) ?? null;

export function facts(runId: string, period: string, statement: "PL" | "BS"): Facts | null {
  const rows = statement === "BS" ? snap.facts["2027-12-BS"] : snap.facts[period];
  if (!rows) return null;
  return { run_id: runId, period: statement === "BS" ? "2027-12" : period, statement, currency: snap.group.reporting_currency, rows };
}

export function lineage(factId: string): Lineage | null {
  const l = snap.lineage[factId];
  if (!l) return null;
  const companiesIn = new Set(l.contributions.map((c) => c.company_id));
  const related = currentFindings(state())
    .filter((f) => f.company_ids.some((c) => companiesIn.has(c)))
    .filter((f) => relatedToAccount(f, l.group_account, l.period))
    .map((f) => f.id);
  return { ...l, finding_ids: related };
}

/** Findings that touch this account and period (by their records' accounts in the answer key). */
function relatedToAccount(f: Finding, account: string, period: string) {
  const fy = period.length === 4;
  const month = (m: string) => fy || period === m;
  switch (f.reference) {
    case "E02":
      return ["REV_IC", "COGS_IC"].includes(account) && month("2027-03");
    case "E08":
      return ["REV_IC", "MGMT_FEE_IC"].includes(account) && month("2027-12");
    case "E04":
      return account === "REV_SALES" && month("2027-08");
    case "E05":
    case "E09":
      return account === "MARKETING";
    case "E01":
      return account === "MARKETING" && month("2027-05");
    case "E06":
      return account === "RENT" && month("2027-04");
    case "E03":
      return ["COGS", "SALARIES", "DEPRECIATION", "OTHER_OPEX", "INTEREST_EXP"].includes(account) && month("2027-06");
    case "E10":
      return period === "2027-12" && account !== "REV_SALES";
    default:
      return false;
  }
}

export const matches = () => snap.matches;
export const journals = () => snap.journals;
export const journal = (id: string) => snap.journals.find((j) => j.id === id) ?? null;
export const findings = () => currentFindings(state());
export const finding = (id: string) => currentFindings(state()).find((f) => f.id === id) ?? null;

export function search(q: string): SearchHit[] {
  const n = q.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
  if (n.length < 2) return [];
  const has = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(n);
  const base = `/g/${PREVIEW_GROUP}`;
  const out: SearchHit[] = [];
  for (const c of snap.companies) if (has(`${c.id} ${c.name} ${c.aliases.join(" ")} ${c.country}`)) out.push({ kind: "company", id: c.id, title: `${c.name}`, subtitle: `${c.id} · ${c.country} · ${c.functional_currency}`, href: `${base}/uploads/${c.id}` });
  for (const r of snap.facts["2027"]!) if (has(`${r.name} ${r.group_account}`)) out.push({ kind: "account", id: r.id, title: r.name, subtitle: `${r.group_account} · FY 2027`, href: r.kind === "line" ? `${base}/inspector/${r.id}` : `${base}?period=2027` });
  for (const f of currentFindings(state())) if (has(`${f.reference} ${f.rule_id} ${f.title} ${f.reason} ${f.company_ids.join(" ")}`)) out.push({ kind: "finding", id: f.id, title: `${f.reference} · ${f.title}`, subtitle: `${f.rule_id} · ${f.severity} · ${f.status.replace("_", " ").toLowerCase()}`, href: `${base}/findings/${f.id}` });
  for (const f of state().files) if (f.status !== "MISSING" && has(f.filename)) out.push({ kind: "file", id: f.id, title: f.filename, subtitle: `${f.company_id} · ${f.records ?? 0} records`, href: `${base}/uploads/${f.company_id}` });
  for (const r of state().runs) if (has(`${r.id} run ${r.number} ${r.status}`)) out.push({ kind: "run", id: r.id, title: `Run #${r.number}`, subtitle: `${r.status.replace(/_/g, " ").toLowerCase()} · ${r.fingerprint.slice(0, 10)}`, href: `${base}/runs/${r.id}` });
  return out.slice(0, 24);
}

// ─── Mutations ──────────────────────────────────────────────────────────────────

export function upload(filename: string, bytes: ArrayBuffer): { file: SourceFile; alreadyImported: boolean } {
  const s = state();
  const sha = createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
  const known = snap.files.find((f) => f.sha256 === sha) ?? snap.files.find((f) => f.filename === filename);
  if (!known) throw new Error("In preview, only the six Grupo AG fixture packs can be parsed. Connect the engine to upload other files.");
  const current = s.files.find((f) => f.company_id === known.company_id)!;
  if (current.sha256 === sha && current.status !== "MISSING") return { file: current, alreadyImported: true };
  Object.assign(current, { ...known, sha256: sha, status: "UPLOADED", uploaded_at: new Date().toISOString(), mapping_version: null });
  return { file: current, alreadyImported: false };
}

export function approveMapping(companyId: string) {
  const f = state().files.find((x) => x.company_id === companyId);
  if (!f || f.status === "MISSING") throw new Error("Upload this company's pack first.");
  f.status = "MAPPING_APPROVED";
  f.mapping_version = "MAP-V1";
}

export function startRun(reason: string) {
  const s = state();
  const missing = s.files.filter((f) => f.status !== "MAPPING_APPROVED");
  if (missing.length) throw new Error(`Approve the mapping for ${missing.map((f) => f.company_id).join(", ")} first.`);
  const parent = s.runs[0]?.id ?? null;
  return createRun(s, parent, reason);
}

export function decide(findingId: string, action: FindingDecision["action"], reason: string, actor: string) {
  const s = state();
  const st = s.findings.get(findingId);
  if (!st) throw new Error("Finding not found.");
  if (!reason.trim()) throw new Error("A reason is required.");
  st.status = action === "RESOLVE" ? "RESOLVED" : action === "ACCEPT_RISK" ? "ACCEPTED_RISK" : "OPEN";
  const parent = s.runs[0]?.id ?? null;
  const ref = snap.findings.find((f) => f.id === findingId)?.reference ?? findingId;
  const verb = action === "RESOLVE" ? "Resolved" : action === "ACCEPT_RISK" ? "Accepted" : "Reopened";
  const nextRun = createRun(s, parent, `${verb} ${ref}: ${reason.trim()}`);
  st.decisions.push({ action, reason: reason.trim(), actor, at: nextRun.created_at, resulting_run_id: nextRun.id });
  return nextRun;
}

export function publish(runId: string) {
  const s = state();
  const r = s.runs.find((x) => x.id === runId);
  if (!r) throw new Error("Run not found.");
  if (r !== s.runs[0]) throw new Error("Only the latest run can be published.");
  if (r.counts.blockers_open > 0) throw new Error(`${r.counts.blockers_open} blocker(s) still open. Resolve or accept them first.`);
  r.status = "PUBLISHED";
  return r;
}
