/**
 * K9 MCP parity harness against the preview snapshot (PIPER-81 / AC15).
 *
 * Simulates the consolidation walkthrough without a live AI client or MCP route:
 *   get_facts(period=2027-01) → pick Revenue → get_fact_lineage → require decimal
 *   strings + source cells. Also checks bilingual tool copy and that no mutating
 *   tool name is registered.
 *
 * Usage: npm run mcp:parity
 *
 * Live Grok/Claude/ChatGPT rows stay `not-verified` until Antonio lands
 * /api/mcp/[token] + HTTPS (PIPER-84/83).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSOLIDATION_TOOL_COPY,
  CONSOLIDATION_WALKTHROUGH_ES,
} from "../lib/mcp/consolidation-copy";

const ROOT = join(import.meta.dirname, "..");
const SNAP = JSON.parse(
  readFileSync(join(ROOT, "lib/api/preview/snapshot.json"), "utf8"),
) as {
  facts: Record<string, Array<{ id: string; name: string; group_account: string; amount: string; kind: string }>>;
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
  matches: Array<{ status: string }>;
  findings: Array<{ id: string; rule_id: string; reference?: string }>;
};

type Row = { client: string; status: "pass" | "fail" | "not-verified"; note: string };

function isDec(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(s);
}

function simulateWalkthrough(): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const rows = SNAP.facts["2027-01"];
  if (!rows?.length) return { ok: false, notes: ["no facts for 2027-01"] };

  const revenue = rows.find((r) => r.group_account === "REVENUE" || r.name === "Revenue");
  if (!revenue) return { ok: false, notes: ["REVENUE fact missing"] };
  if (!isDec(revenue.amount)) return { ok: false, notes: [`non-decimal amount ${revenue.amount}`] };
  notes.push(`get_facts → ${revenue.id} amount=${revenue.amount}`);

  // Lineage is on leaf lines; walkthrough drills a component then the subtotal path.
  const leaf =
    rows.find((r) => r.group_account === "REV_SALES") ??
    rows.find((r) => r.kind === "line" && r.id.includes("REV"));
  if (!leaf) return { ok: false, notes: ["no REV_SALES leaf for lineage"] };

  const lineage = SNAP.lineage[leaf.id];
  if (!lineage) return { ok: false, notes: [`no lineage for ${leaf.id}`] };
  if (!isDec(lineage.amount)) return { ok: false, notes: ["lineage amount not decimal string"] };

  const withSource = lineage.contributions.flatMap((c) =>
    c.records.filter((r) => r.source?.cell || (r.source?.filename && r.source?.row != null)),
  );
  if (withSource.length === 0) {
    return { ok: false, notes: ["lineage has no source cell / file+row refs"] };
  }
  const sample = withSource[0]!.source;
  notes.push(
    `get_fact_lineage(${leaf.id}) → ${withSource.length} sourced records; e.g. ${sample.cell ?? `${sample.filename}:${sample.row}`}`,
  );

  // Published-run stand-in: preview snapshot includes IC flags E02/E08
  const e02 = SNAP.findings.some((f) => f.reference === "E02" || f.rule_id === "VAL-008");
  const e08 = SNAP.findings.some((f) => f.reference === "E08" || f.rule_id === "VAL-007");
  if (!e02 || !e08) notes.push("warn: E02/E08 findings not both present in snapshot");
  else notes.push("snapshot findings include E02 (VAL-008) and E08 (VAL-007)");

  const matched = SNAP.matches.filter((m) => m.status === "MATCHED").length;
  const bad = SNAP.matches.filter((m) => m.status !== "MATCHED").length;
  notes.push(`snapshot matches: ${matched} MATCHED, ${bad} non-matched`);

  return { ok: true, notes };
}

function checkToolCopy(): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const tools = Object.keys(CONSOLIDATION_TOOL_COPY);
  const expected = [
    "get_run_status",
    "get_facts",
    "get_findings",
    "get_reconciliations",
    "get_fact_lineage",
  ];
  for (const t of expected) {
    if (!tools.includes(t)) return { ok: false, notes: [`missing tool copy: ${t}`] };
  }
  const mutating = tools.filter((t) => /^(create|update|delete|post|put|patch|publish|approve|upload)/i.test(t));
  if (mutating.length) return { ok: false, notes: [`mutating tool names registered: ${mutating.join(",")}`] };

  for (const t of expected) {
    const d = CONSOLIDATION_TOOL_COPY[t as keyof typeof CONSOLIDATION_TOOL_COPY].description;
    if (!d.includes("EN:") || !d.includes("ES:")) {
      return { ok: false, notes: [`${t} description not bilingual`] };
    }
    if (!/PUBLISHED|published/i.test(d)) {
      return { ok: false, notes: [`${t} missing published-only guardrail`] };
    }
  }
  notes.push(`tool copy OK for ${expected.join(", ")}`);
  notes.push(`walkthrough prompt: ${CONSOLIDATION_WALKTHROUGH_ES.slice(0, 80)}…`);
  return { ok: true, notes };
}

function main() {
  const copy = checkToolCopy();
  const walk = simulateWalkthrough();
  const previewPass = copy.ok && walk.ok;

  const matrix: Row[] = [
    {
      client: "preview-snapshot (stand-in for published run)",
      status: previewPass ? "pass" : "fail",
      note: [...copy.notes, ...walk.notes].join(" | "),
    },
    {
      client: "Grok",
      status: "not-verified",
      note: "Needs PIPER-84 route + PIPER-83 HTTPS URL",
    },
    {
      client: "Claude",
      status: "not-verified",
      note: "Needs PIPER-84 route + PIPER-83 HTTPS URL",
    },
    {
      client: "ChatGPT",
      status: "not-verified",
      note: "Needs PIPER-84 route + PIPER-83 HTTPS URL",
    },
  ];

  console.log("MCP parity (PIPER-81)");
  for (const row of matrix) {
    console.log(`  [${row.status}] ${row.client}: ${row.note}`);
  }
  console.log(JSON.stringify({ preview_pass: previewPass, matrix }, null, 2));

  if (!previewPass) {
    process.exitCode = 1;
  }
}

main();
