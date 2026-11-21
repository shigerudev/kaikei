/**
 * K6 MCP tools (owners: Antonio + Hugo). MANIFESTO §4.4. READ-ONLY: never register a mutating tool (AC11).
 * Every tool calls lib/metrics (or a read-only query) — never computes figures itself.
 * Every response carries workspace, period, currency, as_of and app_url.
 * Hugo: bilingual descriptions + category aliases (PIPER-38 / AC9).
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { NotImplementedError } from "@/lib/not-implemented";
import { getOverview, getVariance, whatChanged } from "@/lib/metrics";
import { listFlags } from "@/lib/flags";
import { appUrl, type Workspace } from "@/lib/workspaces";
import { Currency, Period } from "@/lib/types";
import { TOOL_COPY } from "./descriptions";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

/** Default period when the assistant doesn't pass one. TODO(Jose): latest period with data instead. */
const currentPeriod = () => new Date().toISOString().slice(0, 7);

function result(ws: Workspace, payload: Record<string, unknown>) {
  const body = {
    workspace: ws.name,
    currency: ws.baseCurrency,
    app_url: appUrl.overview(ws.id),
    ...payload,
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }] };
}

async function run(ws: Workspace, fn: () => Promise<Record<string, unknown>>) {
  try {
    return result(ws, await fn());
  } catch (err) {
    const message =
      err instanceof NotImplementedError ? err.message : "Internal error while reading figures.";
    if (!(err instanceof NotImplementedError)) console.error("[mcp]", { workspaceId: ws.id, err });
    return { isError: true, content: [{ type: "text" as const, text: message }] };
  }
}

export function registerTools(server: McpServer, ws: Workspace) {
  server.registerTool(
    "get_overview",
    {
      title: TOOL_COPY.get_overview.title,
      description: TOOL_COPY.get_overview.description,
      inputSchema: z.object({ period: Period.optional().describe("YYYY-MM") }),
      annotations: READ_ONLY,
    },
    async ({ period }) => run(ws, async () => ({ ...(await getOverview(ws.id, period ?? currentPeriod())) })),
  );

  server.registerTool(
    "get_budget_variance",
    {
      title: TOOL_COPY.get_budget_variance.title,
      description: TOOL_COPY.get_budget_variance.description,
      inputSchema: z.object({
        category: z.string(),
        period: Period.optional(),
        currency: Currency.optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ category, period, currency }) =>
      run(ws, async () => ({
        ...(await getVariance(ws.id, period ?? currentPeriod(), category, currency ?? ws.baseCurrency)),
      })),
  );

  server.registerTool(
    "search_transactions",
    {
      title: TOOL_COPY.search_transactions.title,
      description: TOOL_COPY.search_transactions.description,
      inputSchema: z.object({
        query: z.string().optional(),
        category: z.string().optional(),
        period: Period.optional(),
        has_evidence: z.boolean().optional(),
      }),
      annotations: READ_ONLY,
    },
    async () =>
      run(ws, async () => {
        throw new NotImplementedError("mcp.search_transactions", "Antonio");
      }),
  );

  server.registerTool(
    "get_transaction",
    {
      title: TOOL_COPY.get_transaction.title,
      description: TOOL_COPY.get_transaction.description,
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: READ_ONLY,
    },
    async () =>
      run(ws, async () => {
        throw new NotImplementedError("mcp.get_transaction", "Antonio");
      }),
  );

  server.registerTool(
    "get_document",
    {
      title: TOOL_COPY.get_document.title,
      description: TOOL_COPY.get_document.description,
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: READ_ONLY,
    },
    async () =>
      run(ws, async () => {
        throw new NotImplementedError("mcp.get_document", "Antonio");
      }),
  );

  server.registerTool(
    "list_review_flags",
    {
      title: TOOL_COPY.list_review_flags.title,
      description: TOOL_COPY.list_review_flags.description,
      inputSchema: z.object({ status: z.enum(["open", "resolved", "dismissed"]).optional() }),
      annotations: READ_ONLY,
    },
    async ({ status }) =>
      run(ws, async () => ({ flags: await listFlags(ws.id, status ?? "open"), app_url: appUrl.review(ws.id) })),
  );

  server.registerTool(
    "what_changed",
    {
      title: TOOL_COPY.what_changed.title,
      description: TOOL_COPY.what_changed.description,
      inputSchema: z.object({ import_id: z.string().uuid().optional() }),
      annotations: READ_ONLY,
    },
    async ({ import_id }) => run(ws, async () => ({ ...(await whatChanged(ws.id, import_id)) })),
  );
}
