/**
 * K6 MCP tools (owners: Antonio + Hugo). MANIFESTO §4.4. READ-ONLY: never register a mutating tool (AC11).
 * Every tool calls lib/metrics (or a read-only query) — never computes figures itself.
 * Every response carries workspace, period, currency, as_of and app_url.
 * TODO(Hugo): finalize bilingual descriptions + category aliases (Phase 3).
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { NotImplementedError } from "@/lib/not-implemented";
import { getOverview, getVariance, whatChanged } from "@/lib/metrics";
import { listFlags } from "@/lib/flags";
import { appUrl, type Workspace } from "@/lib/workspaces";
import { Currency, Period } from "@/lib/types";

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
      title: "Overview / Resumen",
      description:
        "EN: Budget, actual and variance per category for a period, plus cash in/out and open review flags. " +
        "ES: Presupuesto, real y variación por rubro para un periodo, más entradas/salidas de efectivo y alertas abiertas.",
      inputSchema: z.object({ period: Period.optional().describe("YYYY-MM") }),
      annotations: READ_ONLY,
    },
    async ({ period }) => run(ws, async () => ({ ...(await getOverview(ws.id, period ?? currentPeriod())) })),
  );

  server.registerTool(
    "get_budget_variance",
    {
      title: "Budget variance / Variación vs presupuesto",
      description:
        "EN: Budget vs actual for one category with the contributing transactions (latest first) and source refs. " +
        "ES: Presupuesto vs real de un rubro, con las transacciones que lo componen y sus comprobantes. " +
        "Category aliases: entregas = Deliveries.",
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
      title: "Search transactions / Buscar transacciones",
      description:
        "EN: Find transactions by text, category, period or whether a bill is attached. " +
        "ES: Busca transacciones por texto, rubro, periodo o si tienen comprobante.",
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
      title: "Transaction / Transacción",
      description:
        "EN: One transaction with its original CSV row and linked bills. " +
        "ES: Una transacción con su fila CSV original y comprobantes vinculados.",
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
      title: "Document / Documento",
      description:
        "EN: Extracted bill fields, the PDF link and the linked transaction. " +
        "ES: Datos extraídos de la factura, enlace al PDF y transacción vinculada.",
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
      title: "Review flags / Alertas por revisar",
      description:
        "EN: Flags with their location (file, row, column) and reason. " +
        "ES: Alertas con su ubicación (archivo, fila, columna) y motivo.",
      inputSchema: z.object({ status: z.enum(["open", "resolved", "dismissed"]).optional() }),
      annotations: READ_ONLY,
    },
    async ({ status }) =>
      run(ws, async () => ({ flags: await listFlags(ws.id, status ?? "open"), app_url: appUrl.review(ws.id) })),
  );

  server.registerTool(
    "what_changed",
    {
      title: "What changed / Qué cambió",
      description:
        "EN: Per-figure deltas (before → after) from the latest or a given import. " +
        "ES: Cambios por cifra (antes → después) de la última importación o de una específica.",
      inputSchema: z.object({ import_id: z.string().uuid().optional() }),
      annotations: READ_ONLY,
    },
    async ({ import_id }) => run(ws, async () => ({ ...(await whatChanged(ws.id, import_id)) })),
  );
}
