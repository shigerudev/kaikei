import { InfoIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { BudgetBar, Money, Variance } from "@/components/money";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Button } from "@/components/ui/button";
import { getCategories, getPeriods, getTransactions, getVariance, getWorkspaceInfo } from "@/lib/data";
import { formatPeriod, pluralize } from "@/lib/format";
import { wsPath } from "@/lib/nav";

export const metadata = { title: "Figure" };

/** Screen 4: figure drilldown — figure → contributing transactions → raw row (via the sheet). */
export default async function FigurePage({ params }: PageProps<"/w/[ws]/figure/[...key]">) {
  const { ws, key } = await params;
  const [period = "", rawCategory = "", currency] = key.map(decodeURIComponent);
  const info = await getWorkspaceInfo(ws);
  const result = await load(() => Promise.all([getVariance(ws, period, rawCategory, currency), getCategories(ws), getPeriods(ws)]));

  const crumbs = [
    { label: "Overview", href: wsPath(ws, `?period=${period}`) },
    { label: formatPeriod(period), href: wsPath(ws, `?period=${period}`) },
    { label: rawCategory },
  ];

  if (!result.ok) {
    return (
      <>
        <PageHeader crumbs={crumbs} preview={info?.dataSource === "preview"} />
        <PageBody>{result.node}</PageBody>
      </>
    );
  }
  const [figure, categories] = result.data;
  if (!figure) {
    return (
      <>
        <PageHeader crumbs={crumbs} preview={info?.dataSource === "preview"} />
        <PageBody>
          <EmptyState icon={SearchXIcon} title="We couldn't find that figure" description={`There's no category called “${rawCategory}” in this workspace.`}>
            <Button variant="outline" size="sm" asChild>
              <Link href={wsPath(ws)}>Back to overview</Link>
            </Button>
          </EmptyState>
        </PageBody>
      </>
    );
  }

  const kind = categories.find((c) => c.id === figure.categoryId)?.kind ?? "expense";
  // Contributors come from the figure itself; full rows (source, evidence, flags) from the record read.
  const ids = new Set(figure.contributors.map((c) => c.transactionId));
  const rows = (await getTransactions(ws, { period })).filter((t) => ids.has(t.id));
  const hasBudget = BigInt(figure.budgetMinor) > 0n;

  return (
    <>
      <PageHeader crumbs={crumbs} asOf={figure.asOf} preview={info?.dataSource === "preview"} />
      <PageBody>
        <PageTitle title={figure.category} description={`${kind === "income" ? "Income" : "Expense"} · ${formatPeriod(period, true)} · ${figure.currency}`} />

        <section className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          <div className="bg-background p-5">
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              <CountUp minor={figure.actualMinor} currency={figure.currency} version={figure.asOf.importId} />
            </p>
            <div className="mt-3">
              <BudgetBar actual={figure.actualMinor} budget={figure.budgetMinor} kind={kind} />
            </div>
          </div>
          <div className="bg-background p-5">
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-muted-foreground">
              <Money minor={figure.budgetMinor} currency={figure.currency} />
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{hasBudget ? `From ${pluralize(figure.budgetLineIds.length, "budget line")}` : "No budget for this period"}</p>
          </div>
          <div className="bg-background p-5">
            <p className="text-xs text-muted-foreground">Variance</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {hasBudget ? <Variance minor={figure.varianceMinor} currency={figure.currency} kind={kind} /> : <span className="text-muted-foreground">—</span>}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Actual − budget, same period, category and currency</p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{pluralize(rows.length, "contributing transaction")}</h2>
            <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <InfoIcon className="size-3.5" /> Open a row to see the original CSV line and any bill
            </p>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={SearchXIcon} title="No transactions yet" description="Nothing has been recorded in this category for the period." />
          ) : (
            <TransactionTable
              ws={ws}
              rows={rows}
              showCategory={false}
              footer={{ label: "Total = Actual", value: <Money minor={figure.actualMinor} currency={figure.currency} /> }}
            />
          )}
        </section>
      </PageBody>
    </>
  );
}
