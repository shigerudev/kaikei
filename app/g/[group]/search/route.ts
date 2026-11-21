/**
 * GET ?q=… → { results: SearchHit[] } for ⌘K. Lives under /g so the auth proxy covers it.
 * A plain GET (not a server action) so search keeps working across deployments.
 */
import { search } from "@/lib/api";

export async function GET(req: Request, ctx: RouteContext<"/g/[group]/search">) {
  const { group } = await ctx.params;
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 100) ?? "";
  const results = q.trim().length < 2 ? [] : await search(group, q).catch(() => []);
  return Response.json({ results }, { headers: { "cache-control": "no-store" } });
}
