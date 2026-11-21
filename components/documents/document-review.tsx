"use client";

import { CheckIcon, FileTextIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { matchAction, saveDocumentFieldsAction } from "@/app/w/[ws]/actions";
import { DocumentStatusBadge } from "@/components/documents/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentDetail, MatchCandidate } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/money";
import { wsPath } from "@/lib/nav";

const REASON: Record<string, string> = {
  amount_exact: "Same amount",
  date_within_3d: "Close date",
  supplier_in_description: "Supplier in description",
};

/** Minor units → "600.00" for editing; and back, by string ops only (no floats). */
const toMajor = (minor: string | null) => (minor ? `${minor.slice(0, -2) || "0"}.${minor.slice(-2).padStart(2, "0")}` : "");
function toMinor(major: string): string | null {
  const s = major.replace(/[,\s]/g, "").replace(/^q/i, "");
  if (!s) return "";
  const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return (BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0")).toString();
}

/**
 * Screen 6: document review. The original page sits beside the extracted fields (R4); match
 * suggestions come from the deterministic scorer and only the owner's Confirm links them (R5).
 */
export function DocumentReview({ ws, doc }: { ws: string; doc: DocumentDetail }) {
  const [pending, start] = useTransition();
  const [fields, setFields] = useState({
    supplier: doc.supplier ?? "",
    date: doc.date ?? "",
    currency: doc.currency ?? "",
    total: toMajor(doc.totalMinor),
  });
  const dirty =
    fields.supplier !== (doc.supplier ?? "") || fields.date !== (doc.date ?? "") || fields.currency !== (doc.currency ?? "") || fields.total !== toMajor(doc.totalMinor);

  const [candidates, setOptimistic] = useOptimistic(doc.candidates, (state: MatchCandidate[], u: { id: string; status: MatchCandidate["status"] }) =>
    state.map((c) => (c.transactionId === u.id ? { ...c, status: u.status } : u.status === "confirmed" && c.status === "confirmed" ? { ...c, status: "suggested" } : c)),
  );
  const confirmed = candidates.find((c) => c.status === "confirmed");
  const open = candidates.filter((c) => c.status === "suggested");

  const save = () => {
    const totalMinor = toMinor(fields.total);
    if (totalMinor === null) return toast.error("Total must look like 600.00");
    start(async () => {
      const res = await saveDocumentFieldsAction(ws, doc.id, { supplier: fields.supplier, date: fields.date, currency: fields.currency.toUpperCase(), totalMinor });
      if (!res.ok) toast.error("Couldn't save", { description: res.error });
      else toast.success("Fields saved", { description: "Suggestions were refreshed." });
    });
  };

  const act = (c: MatchCandidate, action: "confirm" | "reject") =>
    start(async () => {
      setOptimistic({ id: c.transactionId, status: action === "confirm" ? "confirmed" : "rejected" });
      const res = await matchAction(ws, doc.id, c.transactionId, action);
      if (!res.ok) {
        toast.error("Couldn't update the match", { description: res.error });
        return;
      }
      if (action === "confirm") {
        toast.success("Bill linked as evidence", {
          description: `${c.description ?? "Transaction"} · the amount still counts once.`,
          action: { label: "Undo", onClick: () => start(async () => void (await matchAction(ws, doc.id, c.transactionId, "undo"))) },
        });
      }
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section aria-label="Original document" className="overflow-hidden rounded-xl border bg-muted/30 lg:sticky lg:top-16 lg:h-[calc(100svh-8rem)]">
        <div className="flex items-center gap-2 border-b bg-background px-3 py-2 text-xs">
          <FileTextIcon className="size-3.5 text-muted-foreground" />
          <span className="truncate font-mono">{doc.fileName}</span>
          <span className="ml-auto"><DocumentStatusBadge status={confirmed ? "matched" : open.length ? "needs_review" : "uncertain"} /></span>
        </div>
        {doc.fileUrl ? (
          <iframe title={`Original: ${doc.fileName}`} src={`${doc.fileUrl}#toolbar=0&navpanes=0&view=FitH`} className="h-[60svh] w-full bg-white lg:h-[calc(100%-33px)]" />
        ) : (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground lg:h-[calc(100%-33px)]">
            <FileTextIcon className="size-6" />
            <p>Original PDF is stored with the document.</p>
            <p className="text-xs">Preview rendering arrives with file storage.</p>
          </div>
        )}
      </section>

      <div className="space-y-6">
        <section aria-label="Extracted fields" className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Bill details</h2>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {doc.extractedBy === "manual" ? (
                "Entered by you"
              ) : (
                <>
                  <SparklesIcon className="size-3 text-brand" /> {doc.extractedBy === "ai" ? "Suggested by AI" : "Read from the sample"} · check before confirming
                </>
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier" className="col-span-2" value={fields.supplier} onChange={(v) => setFields((f) => ({ ...f, supplier: v }))} confidence={doc.confidence?.supplier} />
            <Field label="Date" type="date" value={fields.date} onChange={(v) => setFields((f) => ({ ...f, date: v }))} confidence={doc.confidence?.date} />
            <Field label="Currency" value={fields.currency} onChange={(v) => setFields((f) => ({ ...f, currency: v }))} confidence={doc.confidence?.currency} maxLength={3} />
            <Field label="Total" className="col-span-2" inputMode="decimal" value={fields.total} onChange={(v) => setFields((f) => ({ ...f, total: v }))} confidence={doc.confidence?.total} placeholder="600.00" />
          </div>
          <div className="flex items-center justify-end gap-2">
            {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || pending} onClick={save}>
              {pending && dirty ? <Loader2Icon className="animate-spin" /> : null}
              Save &amp; re-match
            </Button>
          </div>
        </section>

        <section aria-label="Match" className="space-y-3">
          <h2 className="text-sm font-medium">{confirmed ? "Linked transaction" : "Suggested match"}</h2>
          {confirmed && <CandidateCard ws={ws} c={confirmed} linked />}
          {!confirmed && open.length === 0 && (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No transaction matches this bill yet. Check the total and date, or import the transaction first — the bill stays here for review.
            </div>
          )}
          {!confirmed &&
            open.map((c, i) => (
              <CandidateCard key={c.transactionId} ws={ws} c={c} best={i === 0}>
                <Button size="sm" variant="brand" disabled={pending} onClick={() => act(c, "confirm")}>
                  <CheckIcon /> Confirm match
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(c, "reject")}>
                  <XIcon /> Not this one
                </Button>
              </CandidateCard>
            ))}
          <p className="text-xs text-muted-foreground">Suggestions use exact amount, a ±7-day window and the supplier name. Nothing links until you confirm.</p>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  confidence,
  className = "",
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; confidence?: number; className?: string } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = `field-${label.toLowerCase()}`;
  const low = confidence !== undefined && confidence < 0.9;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id} className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        {low && <span className="text-warning">Check this</span>}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`h-8 ${low ? "border-warning" : ""}`} {...rest} />
    </div>
  );
}

function CandidateCard({ ws, c, best, linked, children }: { ws: string; c: MatchCandidate; best?: boolean; linked?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`enter rounded-xl border p-4 transition-colors ${linked ? "border-brand/40 bg-brand-subtle/40" : best ? "border-foreground/20" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href={wsPath(ws, `/transactions/${c.transactionId}`)} className="block truncate text-sm font-medium hover:underline">
            {c.description ?? "Transaction"}
          </Link>
          <p className="text-xs text-muted-foreground">
            {formatDate(c.date, true)} · {c.category}
          </p>
        </div>
        <span className="num shrink-0 text-sm font-medium">{formatMinor(c.amountMinor, c.currency)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {linked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-brand-foreground">
            <CheckIcon className="size-3" /> Confirmed by you
          </span>
        ) : (
          c.reasons.map((r) => (
            <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{REASON[r] ?? r}</span>
          ))
        )}
      </div>
      {children && <div className="mt-4 flex gap-2">{children}</div>}
    </div>
  );
}
