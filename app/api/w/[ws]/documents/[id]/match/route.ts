/**
 * POST { transactionId, action: "confirm" | "reject" | "suggest", fields?: edited Extraction }
 * (owner: Hugo). Only confirm sets evidence_links to confirmed (R5). Adds evidence, never amount.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import {
  confirmMatch,
  rejectMatch,
  suggestMatches,
} from "@/lib/documents/match";
import { Extraction } from "@/lib/types";
import { getWorkspace } from "@/lib/workspaces";

const Body = z.object({
  action: z.enum(["confirm", "reject", "suggest"]),
  transactionId: z.string().uuid().optional(),
  /** Owner-edited extraction fields (manual path / R4). */
  fields: Extraction.partial().optional(),
});

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/w/[ws]/documents/[id]/match">,
) {
  const { ws: workspaceId, id: documentId } = await ctx.params;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    return Response.json({ error: "workspace_not_found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { action, transactionId, fields } = parsed.data;

  if (fields && Object.keys(fields).length > 0) {
    await db()
      .update(schema.documents)
      .set({
        ...(fields.supplier !== undefined ? { supplier: fields.supplier } : {}),
        ...(fields.date !== undefined ? { docDate: fields.date } : {}),
        ...(fields.currency !== undefined ? { currency: fields.currency } : {}),
        ...(fields.total_minor !== undefined
          ? { totalMinor: BigInt(fields.total_minor) }
          : {}),
        ...(fields.confidence !== undefined
          ? { fieldsConfidence: fields.confidence }
          : {}),
        status: "reviewed",
      })
      .where(eq(schema.documents.id, documentId));
  }

  if (action === "suggest") {
    const suggestions = await suggestMatches({ workspaceId, documentId });
    return Response.json({ documentId, suggestions });
  }

  if (!transactionId) {
    return Response.json(
      { error: "transactionId_required" },
      { status: 400 },
    );
  }

  if (action === "confirm") {
    await confirmMatch({ workspaceId, documentId, transactionId });
    return Response.json({
      documentId,
      transactionId,
      status: "confirmed",
      note: "Evidence attached; amount unchanged",
    });
  }

  await rejectMatch({ workspaceId, documentId, transactionId });
  return Response.json({
    documentId,
    transactionId,
    status: "rejected",
  });
}
