"use client";

import { FlagIcon, PaperclipIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import type { TransactionRow } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/money";
import { wsPath } from "@/lib/nav";

/**
 * Dense, keyboard-navigable transaction list. ↑/↓ (or J/K) move focus, Enter opens the detail sheet.
 * Amounts are rendered exactly as the data source returned them; the optional footer total is passed in.
 */
export function TransactionTable({
  ws,
  rows,
  showCategory = true,
  footer,
}: {
  ws: string;
  rows: TransactionRow[];
  showCategory?: boolean;
  footer?: { label: string; value: React.ReactNode };
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const onKeyDown = (e: React.KeyboardEvent) => {
    const links = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-row]") ?? [])];
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const move = (d: number) => {
      e.preventDefault();
      links[Math.max(0, Math.min(links.length - 1, (i < 0 ? -1 : i) + d))]?.focus();
    };
    if (e.key === "ArrowDown" || e.key === "j") move(1);
    if (e.key === "ArrowUp" || e.key === "k") move(-1);
  };

  const cols = showCategory
    ? "grid-cols-[72px_minmax(0,1fr)_minmax(0,140px)_28px_minmax(0,120px)]"
    : "grid-cols-[72px_minmax(0,1fr)_28px_minmax(0,120px)]";

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className={`grid ${cols} items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground`}>
        <span>Date</span>
        <span>Description</span>
        {showCategory && <span className="hidden sm:block">Category</span>}
        <span className="sr-only">Evidence</span>
        <span className="text-right">Amount</span>
      </div>
      <div ref={listRef} role="list" onKeyDown={onKeyDown}>
        {rows.map((t, i) => (
          <Link
            key={t.id}
            data-row
            role="listitem"
            href={wsPath(ws, `/transactions/${t.id}`)}
            scroll={false}
            onMouseEnter={() => router.prefetch(wsPath(ws, `/transactions/${t.id}`))}
            style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
            className={`enter grid ${cols} items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-brand-subtle/60 focus-visible:outline-none`}
          >
            <span className="num text-muted-foreground">{formatDate(t.date)}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{t.description ?? "—"}</span>
              {t.flagged && <FlagIcon className="size-3.5 shrink-0 text-warning" aria-label="Has an open flag" />}
            </span>
            {showCategory && <span className="hidden truncate text-muted-foreground sm:block">{t.category ?? <span className="italic">Uncategorized</span>}</span>}
            <span className="flex justify-center">
              {t.hasEvidence ? <PaperclipIcon className="size-3.5 text-brand" aria-label="Bill attached" /> : <span className="size-1 rounded-full bg-border" aria-label="No bill" />}
            </span>
            <span className={`num text-right ${BigInt(t.amountMinor) > 0n ? "text-positive" : ""}`}>
              {BigInt(t.amountMinor) > 0n ? "+" : ""}
              {formatMinor(t.amountMinor, t.currency)}
            </span>
          </Link>
        ))}
      </div>
      {footer && (
        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">{footer.label}</span>
          <span className="font-medium">{footer.value}</span>
        </div>
      )}
    </div>
  );
}
