import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { Button } from "@/components/ui/button";
import { getTransaction, getWorkspaceInfo } from "@/lib/data";
import { wsPath } from "@/lib/nav";

export const metadata = { title: "Transaction" };

/** Screen 5 (full page): direct visits and MCP deep links (`app_url`) land here. */
export default async function TransactionPage({ params }: PageProps<"/w/[ws]/transactions/[id]">) {
  const { ws, id } = await params;
  const info = await getWorkspaceInfo(ws);
  const result = await load(() => getTransaction(ws, id));
  const tx = result.ok ? result.data : null;
  const crumbs = [{ label: "Transactions", href: wsPath(ws, "/transactions") }, { label: tx?.description ?? "Transaction" }];

  return (
    <>
      <PageHeader crumbs={crumbs} preview={info?.dataSource === "preview"} />
      <PageBody className="max-w-2xl">
        {!result.ok ? (
          result.node
        ) : !tx ? (
          <EmptyState icon={SearchXIcon} title="Transaction not found" description="It may belong to another workspace, or the link is out of date.">
            <Button variant="outline" size="sm" asChild>
              <Link href={wsPath(ws, "/transactions")}>All transactions</Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">{tx.description ?? "Transaction"}</h1>
            <TransactionDetail ws={ws} tx={tx} />
          </>
        )}
      </PageBody>
    </>
  );
}
