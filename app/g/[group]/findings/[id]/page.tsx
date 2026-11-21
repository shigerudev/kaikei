import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { FindingDetail } from "@/components/findings/finding-detail";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { Button } from "@/components/ui/button";
import { loadFinding } from "@/components/findings/load-finding";
import { dataSource } from "@/lib/api";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Finding" };

/** Finding detail as a full page (direct links); from the list it opens as a sheet. */
export default async function FindingPage({ params }: PageProps<"/g/[group]/findings/[id]">) {
  const { group, id } = await params;
  const result = await load(() => loadFinding(group, id));
  const data = result.ok ? result.data : null;
  return (
    <>
      <PageHeader
        group={group}
        crumbs={[{ label: "Findings", href: gPath(group, "/findings") }, { label: data ? `${data.finding.reference ?? data.finding.rule_id} · ${data.finding.title}` : "Finding" }]}
        run={data?.run}
        preview={dataSource() === "preview"}
      />
      <PageBody className="max-w-2xl">
        {!result.ok ? (
          result.node
        ) : !data ? (
          <EmptyState icon={SearchXIcon} title="Finding not found" description="It may belong to another run.">
            <Button variant="outline" size="sm" asChild>
              <Link href={gPath(group, "/findings")}>All findings</Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              <span className="mr-2 font-mono text-base text-muted-foreground">{data.finding.reference}</span>
              {data.finding.title}
            </h1>
            <FindingDetail group={group} finding={data.finding} match={data.match} companies={data.companies} />
          </>
        )}
      </PageBody>
    </>
  );
}
