import { ArrowLeftRightIcon, SearchXIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { FilterBar } from "@/components/transactions/filter-bar";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { Button } from "@/components/ui/button";
import { getCategories, getTransactions, getWorkspaceInfo, resolvePeriod } from "@/lib/data";
import { formatPeriod, pluralize } from "@/lib/format";
import { wsPath } from "@/lib/nav";

export const metadata = { title: "Transactions" };

/** Transactions list: every accepted record for the period, filterable, keyboard-navigable. */
export default async function TransactionsPage({ params, searchParams }: PageProps<"/w/[ws]/transactions">) {
  const { ws } = await params;
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const [info, { period, periods }] = await Promise.all([getWorkspaceInfo(ws), resolvePeriod(ws, sp.period)]);
  const filtered = Boolean(str(sp.q) || str(sp.category) || str(sp.evidence) || str(sp.flagged));
  const result = await load(() =>
    Promise.all([
      getTransactions(ws, {
        period,
        query: str(sp.q),
        categoryId: str(sp.category),
        hasEvidence: str(sp.evidence) === "yes" ? true : str(sp.evidence) === "no" ? false : undefined,
        flagged: str(sp.flagged) ? true : undefined,
      }),
      getCategories(ws),
    ]),
  );

  return (
    <>
      <PageHeader crumbs={[{ label: "Transactions" }]} period={{ value: period, options: periods }} preview={info?.dataSource === "preview"} />
      <PageBody>
        <PageTitle title="Transactions" description={`Accepted records for ${formatPeriod(period, true)}. Each one traces back to its original CSV row.`}>
          <Button variant="brand" size="sm" asChild>
            <Link href={wsPath(ws, "/import?type=actual")}>
              <UploadIcon /> Import transactions
            </Link>
          </Button>
        </PageTitle>
        {!result.ok ? (
          result.node
        ) : (
          <>
            <FilterBar categories={result.data[1]} />
            {result.data[0].length === 0 ? (
              filtered ? (
                <EmptyState icon={SearchXIcon} title="No transactions match these filters" description="Try another category or clear the filters." />
              ) : (
                <EmptyState icon={ArrowLeftRightIcon} title={`No transactions in ${formatPeriod(period, true)}`} description="Import a bank or accounting export to start.">
                  <Button variant="brand" size="sm" asChild>
                    <Link href={wsPath(ws, "/import?type=actual")}>Import transactions</Link>
                  </Button>
                </EmptyState>
              )
            ) : (
              <>
                <TransactionTable ws={ws} rows={result.data[0]} />
                <p className="text-xs text-muted-foreground">
                  {pluralize(result.data[0].length, "transaction")} · <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to move, <kbd className="font-sans">↵</kbd> to open
                </p>
              </>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
