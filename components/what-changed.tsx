"use client";

import { ArrowRightIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { WhatChangedDelta } from "@/lib/types";
import { formatPeriod } from "@/lib/format";
import { formatMinor } from "@/lib/money";

const noop = () => () => {};

const FIELD = { actual: "Actual", budget: "Budget", variance: "Variance" } as const;

/** "What changed since your last upload" strip. Dismissal is remembered per import (convenience only). */
export function WhatChanged({
  importId,
  fileName,
  summary,
  deltas,
  hrefFor,
}: {
  importId: string;
  fileName: string;
  summary: string;
  deltas: WhatChangedDelta[];
  hrefFor: Record<string, string>;
}) {
  const key = `kaikei:dismissed-change:${importId}`;
  const [hidden, setHidden] = useState(false);
  const dismissed = useSyncExternalStore(
    noop,
    () => {
      try {
        return Boolean(localStorage.getItem(key));
      } catch {
        return false;
      }
    },
    () => false,
  );
  if (hidden || dismissed) return null;

  const shown = deltas.filter((d) => d.field !== "variance");
  return (
    <section aria-label="What changed" className="enter rounded-xl border border-brand/25 bg-brand-subtle/60 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm">
            <span className="font-medium">What changed</span>
            <span className="text-muted-foreground"> · {fileName} · {summary}</span>
          </p>
          {shown.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {shown.map((d, i) => (
                <li key={i}>
                  <Link
                    href={hrefFor[`${d.period}|${d.category}|${d.currency}`] ?? "#"}
                    className="pressable inline-flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm hover:border-brand/40"
                  >
                    <span className="font-medium">{d.category}</span>
                    <span className="text-muted-foreground">{FIELD[d.field]} · {formatPeriod(d.period)}</span>
                    <span className="num text-muted-foreground line-through decoration-muted-foreground/40">{formatMinor(d.beforeMinor, d.currency)}</span>
                    <ArrowRightIcon className="size-3.5 text-muted-foreground" />
                    <span className="num font-medium">{formatMinor(d.afterMinor, d.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No figures changed — every row was already counted.</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          <XIcon />
        </Button>
      </div>
    </section>
  );
}
