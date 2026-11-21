/**
 * POST { mode: "sample" | "empty" }  (owners: Jose + Antonio)
 * sample → clone the seed into a NEW workspace per visitor (no demo collisions; cut-list item 4)
 * empty  → new empty workspace ("Use your own file")
 * → { workspaceId } then the client redirects to /w/<id>
 */
import { notImplementedResponse } from "@/lib/not-implemented";

export async function POST(req: Request) {
  void req;
  return notImplementedResponse("POST /api/trial", "Jose + Antonio");
}
