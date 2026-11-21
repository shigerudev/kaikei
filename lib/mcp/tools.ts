/**
 * K9 MCP tools (PIPER-84). READ-ONLY. Figures come only from lib/api (preview or engine GETs).
 * Copy: lib/mcp/consolidation-copy.ts (Hugo).
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import * as api from "@/lib/api";
import type { Run } from "@/lib/api";
import { CONSOLIDATION_TOOL_COPY } from "@/lib/mcp/consolidation-copy";
import { allowUnpublished } from "@/lib/mcp/auth";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

const Period = z
  .string()
  .regex(/^\d{4}(-\d{2})?$/, "YYYY or YYYY-MM")
  .optional();

export type McpGroup = { id: string };

function jsonResult(payload: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function fail(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

function appBase() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

type ToolResult = ReturnType<typeof jsonResult> | ReturnType<typeof fail>;

type Loaded =
  | { ok: true; run: Run; envelope: Record<string, unknown> }
  | { ok: false; result: ToolResult };

async function loadRun(groupId: string, runId?: string): Promise<Loaded> {
  const run = await api.getRun(groupId, runId);
  if (!run) return { ok: false, result: fail("No consolidation run found for this group.") };
  const published = run.status === "PUBLISHED";
  if (!published && !allowUnpublished()) {
    return {
      ok: false,
      result: fail(
        `Run ${run.id} is ${run.status}, not PUBLISHED. MCP only exposes published snapshots when the engine is connected.`,
      ),
    };
  }
  const warning = published
    ? undefined
    : "This run is not PUBLISHED. Figures are labelled preview/draft. Do not treat them as a frozen snapshot.";
  return {
    ok: true,
    run,
    envelope: {
      data_source: api.dataSource(),
      group_id: groupId,
      run_id: run.id,
      publication: run.status,
      warning,
      app_url: `${appBase()}/g/${groupId}/runs/${run.id}`,
    },
  };
}

export function registerTools(server: McpServer, group: McpGroup) {
  server.registerTool(
    "get_run_status",
    {
      title: CONSOLIDATION_TOOL_COPY.get_run_status.title,
      description: CONSOLIDATION_TOOL_COPY.get_run_status.description,
      inputSchema: z.object({
        run_id: z.string().optional().describe("Run id; omit for the latest run"),
      }),
      annotations: READ_ONLY,
    },
    async ({ run_id }) => {
      const loaded = await loadRun(group.id, run_id);
      if (!loaded.ok) return loaded.result;
      const { run, envelope } = loaded;
      return jsonResult({
        ...envelope,
        fingerprint: run.fingerprint,
        scenario: run.scenario,
        counts: run.counts,
        stages: run.stages,
        reason: run.reason,
        created_at: run.created_at,
      });
    },
  );

  server.registerTool(
    "get_facts",
    {
      title: CONSOLIDATION_TOOL_COPY.get_facts.title,
      description: CONSOLIDATION_TOOL_COPY.get_facts.description,
      inputSchema: z.object({
        period: Period.describe("YYYY-MM or YYYY; default 2027-01"),
        statement: z.enum(["PL", "BS"]).optional(),
        run_id: z.string().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ period, statement, run_id }) => {
      const loaded = await loadRun(group.id, run_id);
      if (!loaded.ok) return loaded.result;
      const { run, envelope } = loaded;
      const facts = await api.getFacts(run.id, period ?? "2027-01", statement ?? "PL");
      if (!facts) return fail("No facts for that period/statement on this run.");
      return jsonResult({ ...envelope, currency: facts.currency, period: facts.period, statement: facts.statement, rows: facts.rows });
    },
  );

  server.registerTool(
    "get_findings",
    {
      title: CONSOLIDATION_TOOL_COPY.get_findings.title,
      description: CONSOLIDATION_TOOL_COPY.get_findings.description,
      inputSchema: z.object({
        run_id: z.string().optional(),
        severity: z.enum(["BLOCKER", "WARNING", "INFO"]).optional(),
        rule_id: z.string().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ run_id, severity, rule_id }) => {
      const loaded = await loadRun(group.id, run_id);
      if (!loaded.ok) return loaded.result;
      const { run, envelope } = loaded;
      let findings = await api.getFindings(run.id);
      if (severity) findings = findings.filter((f) => f.severity === severity);
      if (rule_id) findings = findings.filter((f) => f.rule_id === rule_id);
      return jsonResult({ ...envelope, findings });
    },
  );

  server.registerTool(
    "get_reconciliations",
    {
      title: CONSOLIDATION_TOOL_COPY.get_reconciliations.title,
      description: CONSOLIDATION_TOOL_COPY.get_reconciliations.description,
      inputSchema: z.object({ run_id: z.string().optional() }),
      annotations: READ_ONLY,
    },
    async ({ run_id }) => {
      const loaded = await loadRun(group.id, run_id);
      if (!loaded.ok) return loaded.result;
      const { run, envelope } = loaded;
      const recon = await api.getReconciliations(run.id);
      return jsonResult({ ...envelope, matches: recon.matches, journals: recon.journals });
    },
  );

  server.registerTool(
    "get_fact_lineage",
    {
      title: CONSOLIDATION_TOOL_COPY.get_fact_lineage.title,
      description: CONSOLIDATION_TOOL_COPY.get_fact_lineage.description,
      inputSchema: z.object({
        fact_id: z.string(),
        run_id: z.string().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ fact_id, run_id }) => {
      const loaded = await loadRun(group.id, run_id);
      if (!loaded.ok) return loaded.result;
      const lineage = await api.getLineage(fact_id);
      if (!lineage) return fail("No lineage for that fact_id.");
      return jsonResult({ ...loaded.envelope, lineage });
    },
  );
}

