/**
 * K9 MCP route (MANIFESTO §4.4.1, SCOPE §2 K9, §3 Phase 3 row A, AC15).
 *
 * A minimal, read-only MCP server: just enough JSON-RPC 2.0 (`initialize`,
 * `notifications/initialized`, `tools/list`, `tools/call`) over a single POST
 * endpoint for an MCP client to call the 5 tools in `lib/mcp/consolidation-copy.ts`.
 * No SDK dependency — the official SDK's HTTP transport targets Node's
 * `http.IncomingMessage`/`ServerResponse`, not the Fetch `Request`/`Response` that
 * Next.js Route Handlers use, so hand-rolling the few methods a tool-calling client
 * needs is less code than bridging the two.
 *
 * Every figure is read verbatim from `lib/api` (which itself serves the fixture
 * preview snapshot or proxies the engine) — this file never parses an amount to
 * `number` or computes anything. No mutating tool is registered.
 */
import {
  ApiError,
  dataSource,
  getFacts,
  getFindings,
  getLineage,
  getReconciliations,
  getRun,
} from "@/lib/api";
import type { Run, Severity } from "@/lib/api/types";
import { CONSOLIDATION_TOOL_COPY } from "@/lib/mcp/consolidation-copy";

// ─── Token → group (TODO(Antonio): real per-group token issuance/lookup; MANIFESTO
//     "Per-group token ... never a shared global key". The fixture-pack demo scopes
//     the token to the group it names, 1:1.) ──────────────────────────────────────
function resolveGroupId(token: string): string | null {
  return token ? token : null;
}

// ─── JSON-RPC 2.0 plumbing (just enough for tools/call) ────────────────────────────
type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method: string; params?: Record<string, unknown> };

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } });
}

// ─── MCP tool content helpers ───────────────────────────────────────────────────────
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Traceability on failure: a plain, located message — never a stack trace, never an invented figure. */
function toolError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

// ─── Tool schemas (names/descriptions come from the bilingual copy; MANIFESTO
//     §4.4.1 "Copy: bilingual ES/EN tool descriptions") ─────────────────────────────
const TOOL_DEFS = [
  {
    name: "get_run_status",
    ...CONSOLIDATION_TOOL_COPY.get_run_status,
    inputSchema: { type: "object", properties: { run_id: { type: "string", description: "Run id. Omitted = latest run for this group." } } },
  },
  {
    name: "get_facts",
    ...CONSOLIDATION_TOOL_COPY.get_facts,
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        period: { type: "string", description: "YYYY-MM" },
        statement: { type: "string", enum: ["PL", "BS"] },
      },
      required: ["run_id", "period", "statement"],
    },
  },
  {
    name: "get_findings",
    ...CONSOLIDATION_TOOL_COPY.get_findings,
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        severity: { type: "string", enum: ["BLOCKER", "WARNING", "INFO"] },
        rule_id: { type: "string" },
      },
      required: ["run_id"],
    },
  },
  {
    name: "get_reconciliations",
    ...CONSOLIDATION_TOOL_COPY.get_reconciliations,
    inputSchema: { type: "object", properties: { run_id: { type: "string" } }, required: ["run_id"] },
  },
  {
    name: "get_fact_lineage",
    ...CONSOLIDATION_TOOL_COPY.get_fact_lineage,
    inputSchema: { type: "object", properties: { fact_id: { type: "string" } }, required: ["fact_id"] },
  },
] as const;

type ToolName = (typeof TOOL_DEFS)[number]["name"];

// ─── Publication gate (MANIFESTO §4.4.1 "Scope: only PUBLISHED runs, or an explicit
//     draft flagged as non-publishable preview") ───────────────────────────────────
async function guardPublished(groupId: string, runId: string | undefined): Promise<{ refusal?: string; run: Run; label: Record<string, unknown> }> {
  const run = await getRun(groupId, runId);
  if (!run) throw new Error(`No run found for group "${groupId}"${runId ? ` with id "${runId}"` : ""}.`);
  if (run.status === "PUBLISHED") return { run, label: { run_status: run.status, published: true } };
  if (dataSource() === "preview") {
    // The whole app is already labelled "Preview data" (fixture-pack snapshot) — that
    // is this build's "explicit draft flagged as non-publishable preview".
    return {
      run,
      label: {
        run_status: run.status,
        published: false,
        note: "Preview snapshot stands in for a published run (fixture-pack demo); treat as a non-publishable preview, not a live group figure.",
      },
    };
  }
  return {
    run,
    label: { run_status: run.status, published: false },
    refusal: `Run "${run.id}" is ${run.status}, not PUBLISHED. MCP only serves published runs (MANIFESTO §4.4.1).`,
  };
}

async function callTool(name: ToolName, args: Record<string, unknown>, groupId: string): Promise<ToolResult> {
  switch (name) {
    case "get_run_status": {
      const runId = typeof args.run_id === "string" ? args.run_id : undefined;
      const run = await getRun(groupId, runId);
      if (!run) return toolError(`No run found for group "${groupId}"${runId ? ` with id "${runId}"` : ""}.`);
      return ok({ run_id: run.id, number: run.number, status: run.status, published: run.status === "PUBLISHED", fingerprint: run.fingerprint, scenario: run.scenario, created_at: run.created_at, stages: run.stages, counts: run.counts });
    }

    case "get_facts": {
      const runId = String(args.run_id ?? "");
      const period = String(args.period ?? "");
      const statement = args.statement as "PL" | "BS";
      if (!runId || !period || !statement) return toolError("get_facts requires run_id, period (YYYY-MM) and statement (PL|BS).");
      const guard = await guardPublished(groupId, runId);
      if (guard.refusal) return toolError(guard.refusal);
      const facts = await getFacts(runId, period, statement);
      if (!facts) return toolError(`No facts for run "${runId}", period "${period}", statement "${statement}".`);
      return ok({ ...facts, ...guard.label });
    }

    case "get_findings": {
      const runId = String(args.run_id ?? "");
      if (!runId) return toolError("get_findings requires run_id.");
      const guard = await guardPublished(groupId, runId);
      if (guard.refusal) return toolError(guard.refusal);
      let findings = await getFindings(runId);
      const severity = args.severity as Severity | undefined;
      const ruleId = typeof args.rule_id === "string" ? args.rule_id : undefined;
      if (severity) findings = findings.filter((f) => f.severity === severity);
      if (ruleId) findings = findings.filter((f) => f.rule_id === ruleId);
      // source_refs carried through verbatim — the trace to file/sheet/row/cell.
      return ok({ run_id: runId, count: findings.length, findings, ...guard.label });
    }

    case "get_reconciliations": {
      const runId = String(args.run_id ?? "");
      if (!runId) return toolError("get_reconciliations requires run_id.");
      const guard = await guardPublished(groupId, runId);
      if (guard.refusal) return toolError(guard.refusal);
      const recs = await getReconciliations(runId);
      return ok({ run_id: runId, ...recs, ...guard.label });
    }

    case "get_fact_lineage": {
      const factId = String(args.fact_id ?? "");
      if (!factId) return toolError("get_fact_lineage requires fact_id.");
      const lineage = await getLineage(factId);
      if (!lineage) return toolError(`No lineage for fact_id "${factId}". If this came from get_facts, re-check the fact's id field.`);
      // contributions[].records[].source and adjustments[] carry the source refs — passed through as-is.
      return ok(lineage);
    }
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: JsonRpcRequest | null = null;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error: body is not valid JSON.");
  }
  const hasId = body !== null && typeof body === "object" && "id" in body;
  const id = body?.id ?? null;
  const method = body?.method;

  const groupId = resolveGroupId(token);
  if (!groupId) {
    if (!hasId) return new Response(null, { status: 401 });
    return rpcError(id, -32001, "Missing or unknown MCP token for this route.");
  }

  if (!method) {
    if (!hasId) return new Response(null, { status: 400 });
    return rpcError(id, -32600, "Invalid request: missing method.");
  }

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "kaikei-consolidation", version: "0.1.0" },
        });

      case "notifications/initialized":
        // Notification — no response body per JSON-RPC 2.0.
        return new Response(null, { status: 202 });

      case "tools/list":
        return rpcResult(id, { tools: TOOL_DEFS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })) });

      case "tools/call": {
        const callParams = body?.params ?? {};
        const toolName = callParams.name as string | undefined;
        const toolArgs = (callParams.arguments as Record<string, unknown>) ?? {};
        const def = TOOL_DEFS.find((t) => t.name === toolName);
        if (!def) {
          return rpcResult(id, toolError(`Unknown tool "${toolName}". Available: ${TOOL_DEFS.map((t) => t.name).join(", ")}.`));
        }
        const result = await callTool(def.name, toolArgs, groupId);
        return rpcResult(id, result);
      }

      default:
        if (!hasId) return new Response(null, { status: 202 }); // unknown notification: ignore
        return rpcError(id, -32601, `Method not found: "${method}".`);
    }
  } catch (err) {
    // Traceability on error: what was asked (method/params), what broke, and — for
    // an engine call — the status + path, never a raw stack trace or an invented figure.
    const message =
      err instanceof ApiError ? `${err.message} (engine responded ${err.status} at ${err.path})` : err instanceof Error ? err.message : String(err);
    if (!hasId) return new Response(null, { status: 500 });
    return rpcError(id, -32000, "Tool execution failed.", { method, params: body?.params, error: message });
  }
}
