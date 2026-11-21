/**
 * K9 MCP (PIPER-84): Streamable HTTP at /api/mcp/<group_token>.
 * Read-only. Token-in-path is a demo bearer secret.
 *
 * Production: if Caddy sends /api/* to uvicorn, add an exception so /api/mcp*
 * reaches this Next route (or MCP will 404 on the engine).
 */
import { createMcpHandler } from "mcp-handler";
import { resolveGroupId } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";

async function handle(req: Request, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  const groupId = resolveGroupId(token);
  if (!groupId) return new Response("Unknown group token", { status: 404 });

  const handler = createMcpHandler(
    (server) => registerTools(server, { id: groupId }),
    {
      serverInfo: { name: "kaikei", version: "0.1.0" },
      instructions:
        "Kaikei MCP is read-only over consolidation runs. Quote decimal strings and source refs " +
        "exactly as the tools return them. Never compute, estimate, publish, upload or approve. " +
        "If publication is not PUBLISHED, say so. Prefer get_facts then get_fact_lineage.",
    },
  );
  return handler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
