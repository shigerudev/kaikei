/**
 * Read-only MCP endpoint, one per workspace: /api/mcp/<workspace_mcp_token> (Streamable HTTP).
 * Owner: Antonio. Token-in-path is a demo-only bearer secret (SCOPE §6 A5).
 */
import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/lib/mcp/tools";
import { getWorkspaceByMcpToken } from "@/lib/workspaces";

async function handle(req: Request, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  const ws = await getWorkspaceByMcpToken(token);
  if (!ws) return new Response("Unknown workspace token", { status: 404 }); // AC11

  const handler = createMcpHandler((server) => registerTools(server, ws), {
    serverInfo: { name: "kaikei", version: "0.1.0" },
    instructions:
      "Kaikei is read-only. Always quote the numbers exactly as the tools return them, with period, " +
      "currency and as_of, and include the app_url links. Never compute or estimate figures yourself.",
  });
  return handler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
