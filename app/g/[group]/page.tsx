import { FlagIcon, PlayIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { StatementControls } from "@/components/dashboard/statement-controls";
import { StatementTable } from "@/components/dashboard/statement-table";
import { RunBanner } from "@/components/runs/run-banner";
import { StartRunButton } from "@/components/runs/run-actions";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { Button } from "@/components/ui/button";
import { dataSource, getCompanies, getFacts, getFindings, getGroup, getRun } from "@/lib/api";
import type { FactRow } from "@/lib/api/types";
import { formatAmount, formatCompact, formatPeriod } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";
import { PERIODS, resolvePeriod } from "@/lib/ui/periods";

export const metadata = { title: "Dashboard" };

/** Screen 5: consolidated dashboard — before/after eliminations, publication badge, every line traceable. */
export default async function DashboardPage({ params, searchParams }: PageProps<"/g/[group]">) {
  const { group } = await params;
  const sp = await searchParams;
  const period = resolvePeriod(sp.period);
  const statement = sp.statement === "BS" ? "BS" : "PL";
  const byCompany = sp.view === "companies";
  const preview = dataSource() === "preview";

  const result = await load(async () => {
    const [info, run, companies] = await Promise.all([getGroup(group), getRun(group), getCompanies(group)]);
    if (!run) return { info, run, companies, facts: null, findings: [] };
    const [facts, findings] = await Promise.all([getFacts(run.id, period, statement), getFindings(run.id)]);
    return { info, run, companies, facts, findings };
  });

  const header = (run?: Parameters<typeof PageHeader>[0]["run"]) => (
    <PageHeader group={group} crumbs={[{ label: "Dashboard" }]} period={statement === "PL" ? { value: period, options: PERIODS } : undefined} run={run} preview={preview} />
  );

  if (!result.ok)
    return (
      <>
        {header()}
        <PageBody>{result.node}</PageBody>
      </>
    );

  const { info, run, companies, facts, findings } = result.data;

  if (!run || !facts) {
    return (
      <>
        {header(run)}
        <PageBody>
          <PageTitle title="Consolidated budget" description={`${info?.name} · ${companies.length} companies · ${info?.reporting_currency}`} />
          <EmptyState icon={PlayIcon} title="No consolidation run yet" description="Upload the six company packs, approve each mapping, then start the first run.">
            <Button variant="brand" size="sm" asChild>
              <Link href={gPath(group, "/uploads")}>
                <UploadIcon /> Go to uploads
              </Link>
            </Button>
          </EmptyState>
        </PageBody>
      </>
    );
  }

  const open = findings.filter((f) => f.status === "OPEN" || f.status === "UNDER_REVIEW");
  const blockers = open.filter((f) => f.severity === "BLOCKER");
  const row = (code: string): FactRow | undefined => facts.rows.find((r) => r.group_account === code);
  const kpis =
    statement === "PL"
      ? [
          { label: "Revenue", r: row("REVENUE"), hint: "After eliminations" },
          { label: "Operating profit", r: row("OPERATING_PROFIT"), hint: "Group, all companies" },
          { label: "Net profit", r: row("NET_PROFIT"), hint: "After tax" },
          { label: "Eliminated revenue", r: row("REVENUE"), hint: "Intercompany sales & fees removed", adj: true },
        ]
      : [
          { label: "Total assets", r: row("TOTAL_ASSETS"), hint: "Closing rate 31 Dec 2027" },
          { label: "Total liabilities", r: row("TOTAL_LIABILITIES"), hint: "After IC eliminations" },
          { label: "Equity", r: row("EQUITY"), hint: "Group" },
          { label: "Eliminated balances", r: row("TOTAL_ASSETS"), hint: "IC receivables & loans", adj: true },
        ];
  const excluded = statement === "BS" ? facts.rows[0]?.blocked_companies ?? [] : [];

  return (
    <>
      {header(run)}
      <PageBody className="max-w-7xl">
        <PageTitle
          title={statement === "PL" ? `Consolidated income statement` : "Consolidated balance sheet"}
          description={`${info?.name} · ${statement === "PL" ? formatPeriod(period, true) : "31 December 2027"} · ${facts.currency} · run #${run.number}`}
        >
          <Button variant="outline" size="sm" asChild>
            <Link href={gPath(group, "/findings")}>
              <FlagIcon className={blockers.length ? "text-negative" : undefined} /> {open.length} open findings
            </Link>
          </Button>
          <StartRunButton group={group} />
        </PageTitle>

        <RunBanner group={group} run={run} blockers={blockers} />

        <section aria-label="Key figures" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-background p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1.5 flex items-baseline gap-1 text-2xl font-semibold tracking-tight">
                <span className="text-sm font-normal text-muted-foreground">$</span>
                {k.r ? <CountUp value={k.adj ? k.r.adjustments_total.replace(/^-/, "") : k.r.amount} version={`${run.id}-${period}-${statement}`} /> : "—"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {k.hint}
                {k.r && !k.adj && k.r.adjustments_total && !/^-?0*\.?0*$/.test(k.r.adjustments_total) && (
                  <span className="hidden xl:inline"> · before {formatCompact(k.r.contributions_total, "USD")}</span>
                )}
              </p>
            </div>
          ))}
        </section>

        {excluded.length > 0 && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{excluded.join(", ")} excluded from the consolidated balance.</span> Its balance sheet doesn&apos;t balance (
            <Link href={gPath(group, "/findings/FIND-E10")} className="underline underline-offset-2">E10</Link>, €50,000 gap). Shown struck through by company; never silently netted.
          </p>
        )}

        <div className="space-y-3">
          <StatementControls statement={statement} byCompany={byCompany} />
          <StatementTable group={group} rows={facts.rows} companies={companies} byCompany={byCompany} excluded={excluded} />
          <p className="text-xs text-muted-foreground">
            Amounts in {facts.currency}, rounded half-even for display. Consolidated = Σ translated contributions + Σ eliminations. Open any line to trace it to the source cell.
            {statement === "PL" && <> Total revenue before eliminations: ${formatAmount(row("REVENUE")?.contributions_total ?? "0")}.</>}
          </p>
        </div>
      </PageBody>
    </>
  );
}
