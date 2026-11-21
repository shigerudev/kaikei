import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { DocumentReview } from "@/components/documents/document-review";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { Button } from "@/components/ui/button";
import { getDocument, getWorkspaceInfo } from "@/lib/data";
import { wsPath } from "@/lib/nav";

export const metadata = { title: "Review bill" };

/** Screen 6: document review (full page: the PDF needs the room). */
export default async function DocumentPage({ params }: PageProps<"/w/[ws]/documents/[id]">) {
  const { ws, id } = await params;
  const info = await getWorkspaceInfo(ws);
  const result = await load(() => getDocument(ws, id));
  const doc = result.ok ? result.data : null;

  return (
    <>
      <PageHeader crumbs={[{ label: "Documents", href: wsPath(ws, "/documents") }, { label: doc?.fileName ?? "Document" }]} preview={info?.dataSource === "preview"} />
      <PageBody className="max-w-7xl">
        {!result.ok ? (
          result.node
        ) : !doc ? (
          <EmptyState icon={SearchXIcon} title="Document not found" description="The link may be out of date.">
            <Button variant="outline" size="sm" asChild>
              <Link href={wsPath(ws, "/documents")}>All documents</Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            <h1 className="sr-only">Review {doc.fileName}</h1>
            <DocumentReview key={`${doc.id}-${doc.candidates.map((c) => c.transactionId + c.status).join()}`} ws={ws} doc={doc} />
          </>
        )}
      </PageBody>
    </>
  );
}
