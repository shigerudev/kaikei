/**
 * POST multipart/form-data { file, kind: "csv" | "pdf" }  (owner: Jose)
 * CSV  → storeOriginal → (already imported? return summary) → parseCsvToRows → proposeImport → { importId, proposal }
 * PDF  → storeOriginal → documents row → extractDocument → suggestMatches → { documentId }
 * TODO(Antonio): enforce upload size/type limits (Phase 3).
 */
import { notImplementedResponse } from "@/lib/not-implemented";

export async function POST(req: Request, ctx: RouteContext<"/api/w/[ws]/upload">) {
  void req;
  void ctx;
  return notImplementedResponse("POST /api/w/[ws]/upload", "Jose");
}
