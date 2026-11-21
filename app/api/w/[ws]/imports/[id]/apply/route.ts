/**
 * POST { mapping: MappingProposal }  — owner confirmed type + mapping (R1/R2/R3). Owner: Jose.
 * → applyImport → { counts: { new, repeat, flagged }, changeEventId }
 */
import { notImplementedResponse } from "@/lib/not-implemented";

export async function POST(req: Request, ctx: RouteContext<"/api/w/[ws]/imports/[id]/apply">) {
  void req;
  void ctx;
  return notImplementedResponse("POST /api/w/[ws]/imports/[id]/apply", "Jose");
}
