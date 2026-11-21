/** PATCH { status: "resolved" | "dismissed" }  (owner: Deyane) → setFlagStatus */
import { notImplementedResponse } from "@/lib/not-implemented";

export async function PATCH(req: Request, ctx: RouteContext<"/api/w/[ws]/flags/[id]">) {
  void req;
  void ctx;
  return notImplementedResponse("PATCH /api/w/[ws]/flags/[id]", "Deyane");
}
