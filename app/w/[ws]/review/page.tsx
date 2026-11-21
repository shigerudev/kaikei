import { ReviewQueue } from "@/components/review/review-queue";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { load } from "@/components/states";
import { getFlags, getWorkspaceInfo } from "@/lib/data";
import type { FlagItem } from "@/lib/data/types";

export const metadata = { title: "Review" };

/** Screen 7: review queue. */
export default async function ReviewPage({ params, searchParams }: PageProps<"/w/[ws]/review">) {
  const { ws } = await params;
  const sp = await searchParams;
  const status: FlagItem["status"] = sp.status === "resolved" || sp.status === "dismissed" ? sp.status : "open";
  const info = await getWorkspaceInfo(ws);
  const result = await load(() => getFlags(ws, status));
  return (
    <>
      <PageHeader crumbs={[{ label: "Review" }]} preview={info?.dataSource === "preview"} />
      <PageBody className="max-w-4xl">
        <PageTitle title="Review" description="Records that need a look, with the exact file, row and column. Unreadable rows are never counted until fixed." />
        {result.ok ? <ReviewQueue key={status} ws={ws} flags={result.data} status={status} /> : result.node}
      </PageBody>
    </>
  );
}
