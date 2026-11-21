import { DetailSheet } from "@/components/transactions/detail-sheet";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { getTransaction } from "@/lib/data";
import { NotImplementedError } from "@/lib/not-implemented";
import { wsPath } from "@/lib/nav";

/** Intercepted transaction: opens as a sheet over whatever list linked to it. */
export default async function TransactionSheet({ params }: PageProps<"/w/[ws]/transactions/[id]">) {
  const { ws, id } = await params;
  const tx = await getTransaction(ws, id).catch((err) => {
    if (err instanceof NotImplementedError) return null;
    throw err;
  });
  if (!tx) return null;
  return (
    <DetailSheet title={tx.description ?? "Transaction"} description={`${tx.source.fileName} · row ${tx.source.rowNumber}`} fullHref={wsPath(ws, `/transactions/${id}`)}>
      <TransactionDetail ws={ws} tx={tx} />
    </DetailSheet>
  );
}
