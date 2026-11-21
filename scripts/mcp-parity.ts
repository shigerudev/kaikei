/**
 * K9 MCP parity harness against the preview snapshot (PIPER-81 / AC15).
 *
 * Simulates the five read-only tools without a live AI client or MCP route:
 *   get_run_status → get_facts → get_findings → get_reconciliations → get_fact_lineage
 * Requires decimal strings + source refs. Asserts bilingual copy and no mutating tools.
 *
 * Usage: npm run mcp:parity
 *
 * Live Grok/Claude/ChatGPT rows stay `not-verified` until PIPER-84/83.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSOLIDATION_TOOL_COPY,
  CONSOLIDATION_WALKTHROUGH_EN,
  CONSOLIDATION_WALKTHROUGH_ES,
  FORBIDDEN_MUTATING_TOOL_NAMES,
  READONLY_TOOL_NAMES,
  assertNoMutatingTools,
} from "../lib/mcp/consolidation-copy";

const ROOT = join(import.meta.dirname, "..");
const SNAP = JSON.parse(
  readFileSync(join(ROOT, "lib/api/preview/snapshot.json"), "utf8"),
) as {
  group: { id: string; reporting_currency: string };
  facts: Record<
    string,
    Array<{ id: string; name: string; group_account: string; amount: string; kind: string }>
  >;
  lineage: Record<
    string,
    {
      fact_id: string;
      amount: string;
      contributions: Array<{
        company_id: string;
        amount_group: string;
        records: Array<{
          amount_group: string;
          source: { cell: string | null; filename: string; row: number | null };
        }>;
      }>;
    }
  >;
  matches: Array<{ status: string; difference?: string }>;
  journals: Array<{ id?: string; journal_id?: string }>;
  findings: Array<{
    id: string;
    rule_id: string;
    severity: string;
    reference?: string;
    source?: { filename?: string; row?: number | null };
  }>;
  run_inputs: Record<string, unknown>;
  counts: Record<string, number>;
};

type Row = { client: string; status: "pass" | "fail" | "not-verified"; note: string };

function isDec(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(s);
}

function toolCopyOk(): string[] {
  const notes: string[] = [];
  assertNoMutatingTools([...READONLY_TOOL_NAMES]);
  for (const name of FORBIDDEN_MUTATING_TOOL_NAMES) {
    if ((READONLY_TOOL_NAMES as readonly string[]).includes(name)) {
      throw new Error(`${name} must not be in READONLY_TOOL_NAMES`);
    }
  }
  for (const name of READONLY_TOOL_NAMES) {
    const copy = CONSOLIDATION_TOOL_COPY[name];
    if (!copy.description.includes("EN:") || !copy.description.includes("ES:")) {
      throw new Error(`${name} description not bilingual`);
    }
    if (!/PUBLISHED|published/i.test(copy.description)) {
      throw new Error(`${name} missing published-only guardrail`);
    }
    if (!copy.params?.length && name !== "get_run_status") {
      // get_run_status may omit run_id; others need at least one param
    }
    for (const p of copy.params) {
      if (!p.description.includes("EN:") || !p.description.includes("ES:")) {
        throw new Error(`${name}.${p.name} param not bilingual`);
      }
    }
  }
  notes.push(`tool copy OK (${READONLY_TOOL_NAMES.length} tools, params bilingual)`);
  notes.push(`walkthrough ES/EN ready`);
  notes.push(CONSOLIDATION_WALKTHROUGH_ES.slice(0, 72) + "…");
  notes.push(CONSOLIDATION_WALKTHROUGH_EN.slice(0, 72) + "…");
  return notes;
}

/** Stand-in for get_run_status over the preview snapshot. */
function simRunStatus(): string {
  const fingerprintish = JSON.stringify(SNAP.run_inputs).length;
  const openFindings = SNAP.findings.length;
  // Preview stand-in: treat as labelled non-publishable until engine publish exists.
  return `status=PREVIEW_LABELLED fingerprint_proxy=${fingerprintish} findings=${openFindings} currency=${SNAP.group.reporting_currency}`;
}

function simFacts(period: string): { id: string; amount: string; name: string } {
  const rows = SNAP.facts[period];
  if (!rows?.length) throw new Error(`get_facts: no rows for ${period}`);
  const revenue = rows.find((r) => r.group_account === "REVENUE" || r.name === "Revenue");
  if (!revenue) throw new Error("get_facts: REVENUE missing");
  if (!isDec(revenue.amount)) throw new Error(`get_facts: non-decimal ${revenue.amount}`);
  return { id: revenue.id, amount: revenue.amount, name: revenue.name };
}

function simFindings(): string {
  const e02 = SNAP.findings.find((f) => f.reference === "E02" || f.rule_id === "VAL-008");
  const e08 = SNAP.findings.find((f) => f.reference === "E08" || f.rule_id === "VAL-007");
  if (!e02 || !e08) throw new Error("get_findings: expected E02 (VAL-008) and E08 (VAL-007)");
  const withLoc = SNAP.findings.filter((f) => f.rule_id).length;
  return `findings=${SNAP.findings.length} with_rule=${withLoc}; E02=${e02.id}; E08=${e08.id}`;
}

function simReconciliations(): string {
  const matched = SNAP.matches.filter((m) => m.status === "MATCHED").length;
  const mismatch = SNAP.matches.filter((m) => m.status === "MISMATCH").length;
  const oneSided = SNAP.matches.filter((m) => m.status === "ONE_SIDED").length;
  if (mismatch < 1 || oneSided < 1) {
    throw new Error("get_reconciliations: expected ≥1 MISMATCH and ≥1 ONE_SIDED");
  }
  return `matches MATCHED=${matched} MISMATCH=${mismatch} ONE_SIDED=${oneSided} journals=${SNAP.journals.length}`;
}

function simLineage(period: string): string {
  const rows = SNAP.facts[period];
  const leaf = rows.find((r) => r.group_account === "REV_SALES") ?? rows.find((r) => r.kind === "line");
  if (!leaf) throw new Error("get_fact_lineage: no leaf fact");
  const lineage = SNAP.lineage[leaf.id];
  if (!lineage) throw new Error(`get_fact_lineage: missing lineage for ${leaf.id}`);
  if (!isDec(lineage.amount)) throw new Error("get_fact_lineage: amount not decimal string");
  const sourced = lineage.contributions.flatMap((c) =>
    c.records.filter((r) => r.source?.cell || (r.source?.filename && r.source?.row != null)),
  );
  if (!sourced.length) throw new Error("get_fact_lineage: no source refs");
  if (!sourced.every((r) => isDec(r.amount_group))) {
    throw new Error("get_fact_lineage: contribution amount_group not decimal string");
  }
  const sample = sourced[0]!.source;
  return `${leaf.id} amount=${lineage.amount} sourced=${sourced.length} e.g. ${sample.cell ?? `${sample.filename}:${sample.row}`}`;
}

function simulateTools(): string[] {
  const notes: string[] = [];
  notes.push(`get_run_status → ${simRunStatus()}`);
  const fact = simFacts("2027-01");
  notes.push(`get_facts period=2027-01 → ${fact.id} ${fact.name}=${fact.amount}`);
  notes.push(`get_findings → ${simFindings()}`);
  notes.push(`get_reconciliations → ${simReconciliations()}`);
  notes.push(`get_fact_lineage → ${simLineage("2027-01")}`);
  return notes;
}

function main() {
  let copyNotes: string[] = [];
  let toolNotes: string[] = [];
  let previewPass = true;
  let failReason = "";

  try {
    copyNotes = toolCopyOk();
    toolNotes = simulateTools();
  } catch (e) {
    previewPass = false;
    failReason = e instanceof Error ? e.message : String(e);
  }

  const matrix: Row[] = [
    {
      client: "preview-snapshot (stand-in for published run)",
      status: previewPass ? "pass" : "fail",
      note: previewPass ? [...copyNotes, ...toolNotes].join(" | ") : failReason,
    },
    {
      client: "Grok",
      status: "not-verified",
      note: "Needs PIPER-84 route + PIPER-83 HTTPS token at https://app.kaikei.io/api/mcp/<token>",
    },
    {
      client: "Claude",
      status: "not-verified",
      note: "Needs PIPER-84 route + PIPER-83 HTTPS token",
    },
    {
      client: "ChatGPT",
      status: "not-verified",
      note: "Needs PIPER-84 route + PIPER-83 HTTPS token",
    },
  ];

  console.log("MCP parity (PIPER-81 / AC15)");
  for (const row of matrix) {
    console.log(`  [${row.status}] ${row.client}`);
    console.log(`           ${row.note}`);
  }
  console.log(JSON.stringify({ preview_pass: previewPass, matrix }, null, 2));

  if (!previewPass) process.exitCode = 1;
}

main();
