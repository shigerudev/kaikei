"use client";

import { ArrowUpRightIcon, CheckIcon, CircleCheckBigIcon, EyeOffIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { flagAction } from "@/app/w/[ws]/actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FlagItem } from "@/lib/data/types";
import { formatStamp } from "@/lib/format";
import { wsPath } from "@/lib/nav";

const RULE: Record<string, { label: string; tone: string }> = {
  parse_error: { label: "Couldn't read row", tone: "bg-negative" },
  unmapped_category: { label: "Unknown category", tone: "bg-warning" },
  currency_mismatch: { label: "Other currency", tone: "bg-warning" },
  possible_duplicate: { label: "Possible duplicate", tone: "bg-warning" },
  missing_evidence: { label: "Missing bill", tone: "bg-warning" },
  uncertain_match: { label: "Bill without match", tone: "bg-muted-foreground" },
  budget_missing: { label: "No budget", tone: "bg-muted-foreground" },
  vat_included_suspect: { label: "VAT included?", tone: "bg-muted-foreground" },
};

/** Screen 7: review queue. Grouped by rule, each flag shows where and why; resolve/dismiss are optimistic. */
export function ReviewQueue({ ws, flags, status }: { ws: string; flags: FlagItem[]; status: FlagItem["status"] }) {
  const [, start] = useTransition();
  const [items, remove] = useOptimistic(flags, (state: FlagItem[], id: string) => state.filter((f) => f.id !== id));

  const set = (f: FlagItem, next: FlagItem["status"]) =>
    start(async () => {
      remove(f.id);
      const res = await flagAction(ws, f.id, next);
      if (!res.ok) {
        toast.error("Couldn't update the flag", { description: res.error });
        return;
      }
      if (next !== "open") {
        toast(next === "resolved" ? "Marked as resolved" : "Dismissed", {
          description: f.entity.label,
          action: { label: "Undo", onClick: () => start(async () => void (await flagAction(ws, f.id, "open"))) },
        });
      }
    });

  const groups = [...items.reduce((m, f) => m.set(f.rule, [...(m.get(f.rule) ?? []), f]), new Map<string, FlagItem[]>())];

  const hrefFor = (f: FlagItem) =>
    f.entity.type === "transaction" && f.entity.id
      ? wsPath(ws, `/transactions/${f.entity.id}`)
      : f.entity.type === "document" && f.entity.id
        ? wsPath(ws, `/documents/${f.entity.id}`)
        : null;

  return (
    <div className="space-y-5">
      <Tabs value={status}>
        <TabsList>
          {(["open", "resolved", "dismissed"] as const).map((s) => (
            <TabsTrigger key={s} value={s} asChild>
              <Link href={wsPath(ws, `/review${s === "open" ? "" : `?status=${s}`}`)} scroll={false} className="capitalize">
                {s}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <div className="enter flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
            <CircleCheckBigIcon className="size-5" />
          </span>
          <div>
            <p className="font-medium">{status === "open" ? "All clear" : `No ${status} flags`}</p>
            <p className="text-sm text-muted-foreground">{status === "open" ? "Nothing needs your attention. New uploads are checked automatically." : "Flags you handle show up here."}</p>
          </div>
        </div>
      ) : (
        groups.map(([rule, list]) => (
          <section key={rule} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <span className={`size-1.5 rounded-full ${RULE[rule]?.tone ?? "bg-muted-foreground"}`} />
              {RULE[rule]?.label ?? rule}
              <span className="num text-muted-foreground">{list.length}</span>
            </h2>
            <ul className="overflow-hidden rounded-xl border">
              {list.map((f, i) => {
                const href = hrefFor(f);
                return (
                  <li key={f.id} style={{ "--i": i } as React.CSSProperties} className="enter flex flex-col gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {href ? (
                          <Link href={href} className="inline-flex min-w-0 items-center gap-1 hover:underline">
                            <span className="truncate">{f.entity.label}</span>
                            <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          </Link>
                        ) : (
                          <span className="truncate">{f.entity.label}</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{f.reason}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {[f.fileName, f.rowNumber ? `row ${f.rowNumber}` : null, f.column ? `column “${f.column}”` : null].filter(Boolean).join(" · ")}
                        {f.fileName ? " · " : ""}
                        {formatStamp(f.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {status === "open" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => set(f, "resolved")}>
                            <CheckIcon /> Resolve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => set(f, "dismissed")} className="text-muted-foreground">
                            <EyeOffIcon /> Dismiss
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => set(f, "open")}>
                          <RotateCcwIcon /> Reopen
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
