/**
 * GET ?q=… → { results: SearchResult[] }  (owner: Jordi). Read-only record search for ⌘K.
 */
import { NotImplementedError } from "@/lib/not-implemented";
import { search } from "@/lib/data";

export async function GET(req: Request, ctx: RouteContext<"/api/w/[ws]/search">) {
  const { ws } = await ctx.params;
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 100) ?? "";
  try {
    return Response.json({ results: await search(ws, q) });
  } catch (err) {
    if (err instanceof NotImplementedError) return Response.json({ results: [], notImplemented: err.message });
    throw err;
  }
}
