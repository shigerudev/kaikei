/**
 * POST { transactionId, action: "confirm" | "reject", fields?: edited Extraction }  (owner: Hugo)
 * Only this endpoint can set an evidence link to `confirmed` (R5). Adds evidence, never amount.
 */
import { notImplementedResponse } from "@/lib/not-implemented";

export async function POST(req: Request, ctx: RouteContext<"/api/w/[ws]/documents/[id]/match">) {
  void req;
  void ctx;
  return notImplementedResponse("POST /api/w/[ws]/documents/[id]/match", "Hugo");
}
