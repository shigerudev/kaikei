import { CircleCheckBigIcon, FileSpreadsheetIcon } from "lucide-react";
import Link from "next/link";
import { CompanyTag, FindingStatusText, SeverityBadge, severityDot } from "@/components/badges";
import { FindingsFilters } from "@/components/findings/findings-filters";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { dataSource, getCompanies, getFindings, getRun } from "@/lib/api";
import type { Finding, Severity } from "@/lib/api/types";
import { pluralize } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Findings" };

const ORDER: Severity[] = ["BLOCKER", "WARNING", "INFO"];
const GROUP_LABEL: Record<Severity, string> = { BLOCKER: "Blockers — stop publication", WARNING: "Warnings — counted, flagged", INFO: "Info — no effect on figures" };
const isOpen = (f: Finding) => f.status === "OPEN" || f.status === "UNDER_REVIEW";

/** Screen 4: findings center. Every finding is located (file · line · column) and decided with a reason. */
export default async function FindingsPage({ params, searchParams }: PageProps<"/g/[group]/findings">) {
  const { group } = await params;
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const result = await load(async () => {
    const [run, companies] = await Promise.all([getRun(group), getCompanies(group)]);
    return { run, companies, findings: run ? await getFindings(run.id) : [] };
  });

  if (!result.ok)
    return (
      <>
        <PageHeader group={group} crumbs={[{ label: "Findings" }]} preview={dataSource() === "preview"} />
        <PageBody>{result.node}</PageBody>
      </>
    );

  const { run, companies, findings } = result.data;
  const status = str(sp.status) ?? "open";
  const byStatus = findings.filter((f) => (status === "any" ? true : status === "decided" ? !isOpen(f) : isOpen(f)));
  const filtered = byStatus
    .filter((f) => !str(sp.severity) || f.severity === sp.severity)
    .filter((f) => !str(sp.company) || f.company_ids.includes(sp.company as string))
    .filter((f) => !str(sp.rule) || f.rule_id === sp.rule);
  const counts: Record<string, number> = { all: byStatus.length };
  for (const s of ORDER) counts[s] = byStatus.filter((f) => f.severity === s).length;
  const open = findings.filter(isOpen);

  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Findings" }]} run={run} preview={dataSource() === "preview"} />
      <PageBody className="max-w-5xl">
        <PageTitle
          title="Findings"
          description={
            run ? (
              <>
                {pluralize(open.length, "open finding")} in run #{run.number} · {pluralize(open.filter((f) => f.severity === "BLOCKER").length, "blocker")}. Nothing uncertain is accepted silently.
              </>
            ) : (
              "Start a run to validate the uploaded packs."
            )
          }
        />
        <FindingsFilters companies={companies} rules={[...new Set(findings.map((f) => f.rule_id))].sort()} counts={counts} />

        {filtered.length === 0 ? (
          <EmptyState
            icon={CircleCheckBigIcon}
            title={status === "open" && !sp.severity && !sp.company && !sp.rule ? "No open findings" : "Nothing matches these filters"}
            description={status === "open" ? "Every finding in this run has a recorded decision." : "Try another filter."}
          />
        ) : (
          ORDER.filter((s) => filtered.some((f) => f.severity === s)).map((s) => (
            <section key={s} className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <span className={`size-1.5 rounded-full ${severityDot(s)}`} />
                {GROUP_LABEL[s]}
                <span className="num text-muted-foreground">{filtered.filter((f) => f.severity === s).length}</span>
              </h2>
              <ul className="overflow-hidden rounded-xl border">
                {filtered
                  .filter((f) => f.severity === s)
                  .map((f, i) => (
                    <li key={f.id} style={{ "--i": i } as React.CSSProperties} className="enter">
                      <Link
                        href={gPath(group, `/findings/${f.id}`)}
                        scroll={false}
                        className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:bg-brand-subtle/60 focus-visible:outline-none sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,220px)_auto]"
                      >
                        <span className="pt-0.5 font-mono text-xs">{f.reference ?? "—"}</span>
                        <span className="min-w-0 space-y-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {f.title}
                            <span className="font-mono text-[10px] font-normal text-muted-foreground">{f.rule_id}</span>
                          </span>
                          <span className="line-clamp-1 block text-sm text-muted-foreground">{f.reason}</span>
                          <span className="flex flex-wrap gap-1.5">
                            {f.company_ids.map((c) => (
                              <CompanyTag key={c} id={c} />
                            ))}
                          </span>
                        </span>
                        <span className="hidden items-center gap-1.5 truncate pt-0.5 font-mono text-[11px] text-muted-foreground sm:flex">
                          <FileSpreadsheetIcon className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {f.source_refs[0]?.filename.replace(/^0\d_AG_/, "")}
                            {f.source_refs[0]?.row ? `:${f.source_refs[0].row}` : ""}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1 pt-0.5">
                          <SeverityBadge severity={f.severity} />
                          <FindingStatusText status={f.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        )}
      </PageBody>
    </>
  );
}
