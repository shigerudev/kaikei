import { FileTextIcon, FlagIcon, PaperclipIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import type { TransactionDetail as Detail } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import { wsPath } from "@/lib/nav";

/** Transaction detail body, shared by the intercepted sheet and the full page (MCP deep links). */
export function TransactionDetail({ ws, tx }: { ws: string; tx: Detail }) {
  const positive = BigInt(tx.amountMinor) > 0n;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className={`text-3xl font-semibold tracking-tight ${positive ? "text-positive" : ""}`}>
          {positive ? "+" : ""}
          <Money minor={tx.amountMinor} currency={tx.currency} />
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDate(tx.date, true)} · {tx.category ?? "Uncategorized"} · {tx.currency}
        </p>
      </div>

      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-muted-foreground">Description</dt>
        <dd className="min-w-0 break-words">{tx.description ?? "—"}</dd>
        <dt className="text-muted-foreground">Counterparty</dt>
        <dd>{tx.counterparty ?? "—"}</dd>
        <dt className="text-muted-foreground">Category</dt>
        <dd>{tx.category ?? <span className="italic text-muted-foreground">Uncategorized</span>}</dd>
      </dl>

      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Original row</h3>
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
            <span className="truncate font-mono">{tx.source.fileName}</span>
            <span className="shrink-0 text-muted-foreground">row {tx.source.rowNumber}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  {tx.headers.map((h) => (
                    <th key={h} className="px-3 pt-2 pb-1 text-left font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {tx.headers.map((h) => (
                    <td key={h} className="px-3 pt-1 pb-2.5 whitespace-nowrap">{tx.raw[h] ?? ""}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Stored exactly as uploaded. Kaikei never edits original rows.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Evidence</h3>
        {tx.documents.length > 0 ? (
          <ul className="space-y-2">
            {tx.documents.map((d) => (
              <li key={d.id}>
                <Link href={wsPath(ws, `/documents/${d.id}`)} className="pressable flex items-center gap-3 rounded-lg border p-3 hover:border-brand/40">
                  <span className="flex size-9 items-center justify-center rounded-md bg-brand-subtle text-brand">
                    <PaperclipIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.fileName}</span>
                    <span className="block text-xs text-muted-foreground">{d.supplier ?? "Bill"} · Confirmed by you</span>
                  </span>
                  {d.totalMinor && d.currency && <Money minor={d.totalMinor} currency={d.currency} className="text-sm" />}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileTextIcon className="size-4" /> No bill attached
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href={wsPath(ws, "/documents?upload=1")}>
                <UploadIcon /> Upload bill
              </Link>
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">A bill adds proof to this transaction. It never changes the amount.</p>
      </section>

      {tx.flags.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Flags</h3>
          <ul className="space-y-2">
            {tx.flags.map((f) => (
              <li key={f.id} className="flex gap-2.5 rounded-lg border p-3 text-sm">
                <FlagIcon className={`mt-0.5 size-3.5 shrink-0 ${f.status === "open" ? "text-warning" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <p>{f.reason}</p>
                  <p className="text-xs text-muted-foreground">{f.rule.replace(/_/g, " ")} · {f.status}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
