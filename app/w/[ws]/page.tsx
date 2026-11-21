import { ArrowUpRightIcon, FileTextIcon, FlagIcon, InboxIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { BudgetBar, Money, Variance } from "@/components/money";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { Button } from "@/components/ui/button";
import { WhatChanged } from "@/components/what-changed";
import { getCategories, getFlags, getImports, getOverview, getWhatChanged, getWorkspaceInfo, resolvePeriod } from "@/lib/data";
import type { Category } from "@/lib/data/types";
import { formatPeriod, formatStamp, pluralize } from "@/lib/format";
import { wsPath } from "@/lib/nav";

export const metadata = { title: "Overview" };

const figureHref = (ws: string, period: string, category: string, currency: string) =>
  wsPath(ws, `/figure/${period}/${encodeURIComponent(category)}/${currency}`);

/** Screen 2: Overview. Renders ONLY data-source figures (getOverview + whatChanged); computes nothing. */
export default async function OverviewPage({ params, searchParams }: PageProps<"/w/[ws]">) {
  const { ws } = await params;
  const sp = await searchParams;
  const [info, { period, periods }] = await Promise.all([getWorkspaceInfo(ws), resolvePeriod(ws, sp.period)]);
  const result = await load(() =>
    Promise.all([getOverview(ws, period), getCategories(ws), getWhatChanged(ws), getImports(ws), getFlags(ws, "open")]),
  );

  const header = (asOf?: Parameters<typeof PageHeader>[0]["asOf"]) => (
    <PageHeader crumbs={[{ label: "Overview" }]} period={{ value: period, options: periods }} asOf={asOf} preview={info?.dataSource === "preview"} />
  );

  if (!result.ok) {
    return (
      <>
        {header()}
        <PageBody>{result.node}</PageBody>
      </>
    );
  }

  const [overview, categories, changed, imports, flags] = result.data;
  const kindOf = new Map<string, Category["kind"]>(categories.map((c) => [c.name, c.kind]));
  const expenses = overview.categories.filter((c) => kindOf.get(c.category) !== "income");
  const income = overview.categories.filter((c) => kindOf.get(c.category) === "income");
  const overCount = expenses.filter((c) => BigInt(c.varianceMinor) > 0n && BigInt(c.budgetMinor) > 0n).length;
  const latestImport = imports.find((i) => i.id === changed.importId);
  const hrefFor = Object.fromEntries(
    changed.deltas.map((d) => [`${d.period}|${d.category}|${d.currency}`, figureHref(ws, d.period, d.category, d.currency)]),
  );
  const version = overview.asOf.importId;

  return (
    <>
      {header(overview.asOf)}
      <PageBody>
        <PageTitle title="Overview" description={`${info?.name} · ${formatPeriod(period, true)}`}>
          <Button variant="outline" size="sm" asChild>
            <Link href={wsPath(ws, "/documents?upload=1")}>
              <FileTextIcon /> Upload bill
            </Link>
          </Button>
          <Button variant="brand" size="sm" asChild>
            <Link href={wsPath(ws, "/import")}>
              <UploadIcon /> Import CSV
            </Link>
          </Button>
        </PageTitle>

        {latestImport && latestImport.counts && changed.deltas.length > 0 && (
          <WhatChanged
            importId={latestImport.id}
            fileName={latestImport.fileName}
            summary={`${pluralize(latestImport.counts.new, "new row")} · ${latestImport.counts.repeat} already imported · ${latestImport.counts.flagged} flagged`}
            deltas={changed.deltas}
            hrefFor={hrefFor}
          />
        )}

        <section aria-label="Key figures" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
          <Kpi label="Money in" hint="Received this period">
            <CountUp minor={overview.cash.inMinor} currency={overview.currency} version={version} />
          </Kpi>
          <Kpi label="Money out" hint="Paid this period">
            <CountUp minor={overview.cash.outMinor} currency={overview.currency} version={version} />
          </Kpi>
          <Kpi label="Over budget" hint={overCount ? "Expense categories above plan" : "Every category within plan"}>
            <span className={overCount ? "text-negative" : undefined}>{pluralize(overCount, "category", "categories")}</span>
          </Kpi>
          <Kpi label="Needs review" hint="Open flags" href={wsPath(ws, "/review")}>
            <span>{pluralize(overview.openFlags, "flag")}</span>
          </Kpi>
        </section>

        {overview.categories.length === 0 ? (
          <EmptyState icon={InboxIcon} title={`Nothing recorded for ${formatPeriod(period, true)}`} description="Import a budget or a transactions CSV to see planned vs recorded figures.">
            <Button variant="brand" size="sm" asChild>
              <Link href={wsPath(ws, "/import")}>Import CSV</Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section aria-label="Budget vs actual" className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-center gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>Category</span>
                <span className="text-right max-sm:hidden">Budget</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Variance</span>
              </div>
              <CategoryRows title="Expenses" rows={expenses} ws={ws} kind="expense" />
              {income.length > 0 && <CategoryRows title="Income" rows={income} ws={ws} kind="income" />}
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium">Needs review</h2>
                  <Link href={wsPath(ws, "/review")} className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
                </div>
                {flags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All clear. Nothing waiting on you.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {flags.slice(0, 4).map((f) => (
                      <li key={f.id} className="flex gap-2.5 text-sm">
                        <FlagIcon className={`mt-0.5 size-3.5 shrink-0 ${f.severity === "error" ? "text-negative" : "text-warning"}`} />
                        <div className="min-w-0">
                          <p className="truncate">{f.entity.label}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{f.reason}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border p-4">
                <h2 className="mb-3 text-sm font-medium">Recent imports</h2>
                <ul className="space-y-2.5">
                  {imports.slice(0, 4).map((i) => (
                    <li key={i.id} className="text-sm">
                      <p className="truncate font-mono text-xs">{i.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.type === "budget" ? "Budget" : "Actuals"} · {i.appliedAt ? formatStamp(i.appliedAt) : "—"}
                        {i.counts ? ` · ${i.counts.new} new` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Kpi({ label, hint, href, children }: { label: string; hint: string; href?: string; children: React.ReactNode }) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">{children}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </>
  );
  return href ? (
    <Link href={href} className="group bg-background p-4 transition-colors hover:bg-muted/40">
      {body}
    </Link>
  ) : (
    <div className="bg-background p-4">{body}</div>
  );
}

function CategoryRows({ title, rows, ws, kind }: { title: string; rows: Awaited<ReturnType<typeof getOverview>>["categories"]; ws: string; kind: Category["kind"] }) {
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul>
        {rows.map((c, i) => (
          <li key={`${c.category}-${c.currency}`} style={{ "--i": i } as React.CSSProperties} className="enter">
            <Link
              href={figureHref(ws, c.period, c.category, c.currency)}
              className="group grid grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-center gap-4 border-b border-border/60 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <span className="min-w-0 space-y-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{c.category}</span>
                  <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <BudgetBar actual={c.actualMinor} budget={c.budgetMinor} kind={kind} />
              </span>
              <Money minor={c.budgetMinor} currency={c.currency} className="text-right text-muted-foreground max-sm:hidden" />
              <Money minor={c.actualMinor} currency={c.currency} className="text-right font-medium" />
              <span className="text-right">
                {BigInt(c.budgetMinor) === 0n ? <span className="text-xs text-muted-foreground">No budget</span> : <Variance minor={c.varianceMinor} currency={c.currency} kind={kind} />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
