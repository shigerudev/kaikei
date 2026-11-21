/**
 * Stage ④d match suggestion (owner: Hugo). Produces K5.
 * DETERMINISTIC scorer: amount exact (strong), date within ±7 days, supplier token overlap.
 * Optional AI tie-break among filtered candidates (cut-list item 1).
 * Review point R5: ONLY an owner confirmation sets `confirmed`. No auto-confirm.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { suggest } from "@/lib/ai/suggest";
import { db, schema } from "@/lib/db";
import {
  MatchSuggestion,
  type MatchReason,
  type MatchSuggestion as MatchSuggestionType,
} from "@/lib/types";

export const MATCH_THRESHOLD = 0.6;
export const DATE_WINDOW_DAYS = 7;

export type TxCandidate = {
  id: string;
  date: string;
  amountMinor: bigint;
  currency: string;
  description: string | null;
  counterparty: string | null;
};

export type DocFields = {
  id: string;
  supplier: string | null;
  docDate: string | null;
  currency: string | null;
  totalMinor: bigint | null;
};

function daysBetween(a: string, b: string): number {
  const ms =
    Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(ms) / (1000 * 60 * 60 * 24);
}

function tokens(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9]+/u)
      .filter((t) => t.length > 2),
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / Math.min(a.size, b.size);
}

/** Pure scorer for tests and AI-off path. */
export function scoreMatch(
  doc: DocFields,
  tx: TxCandidate,
): MatchSuggestionType | null {
  if (doc.totalMinor == null || !doc.currency || !doc.docDate) return null;
  if (tx.currency !== doc.currency) return null;

  const reasons: MatchReason[] = [];
  let score = 0;

  if (tx.amountMinor === doc.totalMinor || tx.amountMinor === -doc.totalMinor) {
    reasons.push("amount_exact");
    score += 0.5;
  } else {
    return null; // amount must match exactly in MVP
  }

  const delta = daysBetween(tx.date, doc.docDate);
  if (delta <= DATE_WINDOW_DAYS) {
    // K5 enum keeps date_within_3d label from SCOPE; window is ±7d per MANIFESTO.
    reasons.push("date_within_3d");
    score += 0.25 * (1 - delta / (DATE_WINDOW_DAYS + 1));
  }

  const supplierTok = tokens(doc.supplier);
  const txTok = new Set([
    ...tokens(tx.description),
    ...tokens(tx.counterparty),
  ]);
  const overlap = tokenOverlap(supplierTok, txTok);
  if (overlap > 0) {
    reasons.push("supplier_in_description");
    score += 0.25 * overlap;
  }

  if (score < MATCH_THRESHOLD) return null;

  return MatchSuggestion.parse({
    document_id: doc.id,
    transaction_id: tx.id,
    score: Math.min(1, Number(score.toFixed(4))),
    reasons,
  });
}

export async function suggestMatches(input: {
  workspaceId: string;
  documentId: string;
}): Promise<MatchSuggestionType[]> {
  const [doc] = await db()
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, input.documentId),
        eq(schema.documents.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  if (!doc) return [];

  const txs = await db()
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.workspaceId, input.workspaceId));

  const docFields: DocFields = {
    id: doc.id,
    supplier: doc.supplier,
    docDate: doc.docDate,
    currency: doc.currency,
    totalMinor: doc.totalMinor,
  };

  let scored = txs
    .map((tx) =>
      scoreMatch(docFields, {
        id: tx.id,
        date: tx.date,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        description: tx.description,
        counterparty: tx.counterparty,
      }),
    )
    .filter((m): m is MatchSuggestionType => m != null)
    .sort((a, b) => b.score - a.score);

  // Optional AI tie-break when top two are close
  if (scored.length >= 2 && scored[0]!.score - scored[1]!.score < 0.05) {
    const Tiebreak = z.object({
      transaction_id: z.string().uuid(),
      rationale: z.string(),
    });
    const pick = await suggest({
      workspaceId: input.workspaceId,
      capability: "match_tiebreak",
      targetRef: `document:${input.documentId}`,
      promptVersion: "match_tiebreak.v1",
      system:
        "Pick the single best matching transaction id from the candidates. Do not invent ids.",
      data: {
        document: docFields,
        candidates: scored.slice(0, 5),
      },
      schema: Tiebreak,
      checkReal: (p) =>
        scored.some((s) => s.transaction_id === p.transaction_id)
          ? null
          : "invented transaction id",
    });
    if (pick) {
      const winner = scored.find(
        (s) => s.transaction_id === pick.proposed.transaction_id,
      );
      if (winner) {
        scored = [
          winner,
          ...scored.filter(
            (s) => s.transaction_id !== winner.transaction_id,
          ),
        ];
      }
    }
  }

  // Persist suggestions (replace prior suggested rows for this doc)
  for (const m of scored) {
    await db()
      .insert(schema.evidenceLinks)
      .values({
        documentId: m.document_id,
        transactionId: m.transaction_id,
        status: "suggested",
        score: m.score,
        reasons: m.reasons,
      })
      .onConflictDoUpdate({
        target: [
          schema.evidenceLinks.documentId,
          schema.evidenceLinks.transactionId,
        ],
        set: {
          score: m.score,
          reasons: m.reasons,
          status: "suggested",
        },
      });
  }

  if (scored.length === 0) {
    await db().insert(schema.flags).values({
      workspaceId: input.workspaceId,
      rule: "uncertain_match",
      severity: "warning",
      entityType: "document",
      entityId: input.documentId,
      reason: "No transaction candidate above match threshold",
    });
  }

  return scored;
}

export async function confirmMatch(input: {
  workspaceId: string;
  documentId: string;
  transactionId: string;
}): Promise<void> {
  // Reject other suggestions for this document, confirm the chosen one.
  await db()
    .update(schema.evidenceLinks)
    .set({ status: "rejected" })
    .where(
      and(
        eq(schema.evidenceLinks.documentId, input.documentId),
        eq(schema.evidenceLinks.status, "suggested"),
      ),
    );

  await db()
    .insert(schema.evidenceLinks)
    .values({
      documentId: input.documentId,
      transactionId: input.transactionId,
      status: "confirmed",
      score: 1,
      reasons: ["amount_exact"],
      confirmedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.evidenceLinks.documentId,
        schema.evidenceLinks.transactionId,
      ],
      set: {
        status: "confirmed",
        confirmedAt: new Date(),
      },
    });
}

export async function rejectMatch(input: {
  workspaceId: string;
  documentId: string;
  transactionId: string;
}): Promise<void> {
  await db()
    .update(schema.evidenceLinks)
    .set({ status: "rejected" })
    .where(
      and(
        eq(schema.evidenceLinks.documentId, input.documentId),
        eq(schema.evidenceLinks.transactionId, input.transactionId),
      ),
    );
}
