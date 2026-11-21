import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { RunStatusBadge } from "@/components/badges";
import { StartRunButton } from "@/components/runs/run-actions";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { dataSource, getRuns } from "@/lib/api";
import { formatStamp, shortHash } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Runs" };

/** Every run is immutable; identical fingerprints mean identical inputs and identical totals. */
export default async function RunsPage({ params, searchParams }: PageProps<"/g/[group]/runs">) {
  const { group } = await params;
  const { start } = await searchParams;
  const result = await load(() => getRuns(group));
  const runs = result.ok ? result.data : [];
  const fpCount = new Map<string, number>();
  for (const r of runs) fpCount.set(r.fingerprint, (fpCount.get(r.fingerprint) ?? 0) + 1);

  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Runs" }]} run={runs[0]} preview={dataSource() === "preview"} />
      <PageBody className="max-w-5xl">
        <PageTitle title="Runs" description="Each run pins its files, mapping, rate set and rule set. Decisions and corrections create new runs; published runs are never overwritten.">
          <StartRunButton group={group} variant="brand" defaultOpen={start === "1"} />
        </PageTitle>
        {!result.ok ? (
          result.node
        ) : runs.length === 0 ? (
          <EmptyState icon={PlayIcon} title="No runs yet" description="Approve all six mappings in Uploads, then start the first run." />
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[64px_minmax(0,1fr)_150px_120px] items-center gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[56px_minmax(0,1fr)_120px]">
              <span>Run</span>
              <span>Reason</span>
              <span className="max-md:hidden">Fingerprint</span>
              <span className="text-right">Status</span>
            </div>
            {runs.map((r, i) => (
              <Link
                key={r.id}
                href={gPath(group, `/runs/${r.id}`)}
                style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                className="enter grid grid-cols-[64px_minmax(0,1fr)_150px_120px] items-center gap-4 border-b border-border/60 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/40 max-md:grid-cols-[56px_minmax(0,1fr)_120px]"
              >
                <span className="num font-medium">#{r.number}</span>
                <span className="min-w-0">
                  <span className="block truncate">{r.reason}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatStamp(r.created_at)} · {r.counts.findings_open} open · {r.counts.blockers_open} blockers
                  </span>
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground max-md:hidden">
                  {shortHash(r.fingerprint)}
                  {(fpCount.get(r.fingerprint) ?? 0) > 1 && <span className="ml-1.5 rounded bg-brand-subtle px-1 text-[10px] text-brand">same inputs</span>}
                </span>
                <span className="flex justify-end">
                  <RunStatusBadge status={r.status} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
