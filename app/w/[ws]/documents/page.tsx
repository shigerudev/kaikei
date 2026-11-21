import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { DocumentStatusBadge } from "@/components/documents/status-badge";
import { UploadBill } from "@/components/documents/upload-bill";
import { Money } from "@/components/money";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { getDocuments, getWorkspaceInfo } from "@/lib/data";
import { formatDate, formatStamp } from "@/lib/format";
import { wsPath } from "@/lib/nav";

export const metadata = { title: "Documents" };

/** Bills and receipts, newest first; each opens the side-by-side review screen. */
export default async function DocumentsPage({ params, searchParams }: PageProps<"/w/[ws]/documents">) {
  const { ws } = await params;
  const { upload } = await searchParams;
  const info = await getWorkspaceInfo(ws);
  const result = await load(() => getDocuments(ws));

  return (
    <>
      <PageHeader crumbs={[{ label: "Documents" }]} preview={info?.dataSource === "preview"} />
      <PageBody>
        <PageTitle title="Documents" description="Bills and receipts. A confirmed bill adds proof to a transaction — never a second amount.">
          <UploadBill ws={ws} defaultOpen={upload === "1"} />
        </PageTitle>
        {!result.ok ? (
          result.node
        ) : result.data.length === 0 ? (
          <EmptyState icon={FileTextIcon} title="No bills yet" description="Upload a PDF bill and we'll suggest which transaction it supports." />
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,160px)_88px_120px_130px] items-center gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_110px]">
              <span>File</span>
              <span className="max-md:hidden">Supplier</span>
              <span className="max-md:hidden">Date</span>
              <span className="text-right max-md:hidden">Total</span>
              <span className="text-right">Status</span>
            </div>
            {result.data.map((d, i) => (
              <Link
                key={d.id}
                href={wsPath(ws, `/documents/${d.id}`)}
                style={{ "--i": i } as React.CSSProperties}
                className="enter grid grid-cols-[minmax(0,1fr)_minmax(0,160px)_88px_120px_130px] items-center gap-4 border-b border-border/60 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-brand-subtle/60 focus-visible:outline-none max-md:grid-cols-[minmax(0,1fr)_110px]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.fileName}</span>
                    <span className="block text-xs text-muted-foreground">Uploaded {formatStamp(d.uploadedAt)}</span>
                  </span>
                </span>
                <span className="truncate text-muted-foreground max-md:hidden">{d.supplier ?? "—"}</span>
                <span className="num text-muted-foreground max-md:hidden">{d.date ? formatDate(d.date) : "—"}</span>
                <span className="text-right max-md:hidden">{d.totalMinor && d.currency ? <Money minor={d.totalMinor} currency={d.currency} /> : "—"}</span>
                <span className="flex justify-end"><DocumentStatusBadge status={d.status} /></span>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
