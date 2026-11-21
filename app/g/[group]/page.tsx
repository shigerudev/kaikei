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

export const metadata = { title: "Panel" };

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
    <PageHeader group={group} crumbs={[{ label: "Panel" }]} period={statement === "PL" ? { value: period, options: PERIODS } : undefined} run={run} preview={preview} />
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
          <PageTitle title="Presupuesto consolidado" description={`${info?.name} · ${companies.length} empresas · ${info?.reporting_currency}`} />
          <EmptyState icon={PlayIcon} title="Aún no hay ejecuciones" description="Sube el paquete de cada empresa, aprueba su mapeo y lanza la primera ejecución.">
            <Button variant="brand" size="sm" asChild>
              <Link href={gPath(group, "/uploads")}>
                <UploadIcon /> Ir a cargas
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
          { label: "Ingresos", r: row("REVENUE"), hint: "Después de eliminaciones" },
          { label: "Utilidad operativa", r: row("OPERATING_PROFIT"), hint: "Grupo, todas las empresas" },
          { label: "Utilidad neta", r: row("NET_PROFIT"), hint: "Después de impuestos" },
          { label: "Ingresos eliminados", r: row("REVENUE"), hint: "Ventas y cargos intercompañía", adj: true },
        ]
      : [
          { label: "Total activos", r: row("TOTAL_ASSETS"), hint: "Tasa de cierre 31 dic 2027" },
          { label: "Total pasivos", r: row("TOTAL_LIABILITIES"), hint: "Después de eliminaciones IC" },
          { label: "Patrimonio", r: row("EQUITY"), hint: "Grupo" },
          { label: "Saldos eliminados", r: row("TOTAL_ASSETS"), hint: "Cuentas y préstamos IC", adj: true },
        ];
  const excluded = statement === "BS" ? facts.rows[0]?.blocked_companies ?? [] : [];

  return (
    <>
      {header(run)}
      <PageBody className="max-w-7xl">
        <PageTitle
          title={statement === "PL" ? "Estado de resultados consolidado" : "Balance general consolidado"}
          description={`${info?.name} · ${statement === "PL" ? formatPeriod(period, true) : "31 de diciembre de 2027"} · ${facts.currency} · ejecución #${run.number}`}
        >
          <Button variant="outline" size="sm" asChild>
            <Link href={gPath(group, "/findings")}>
              <FlagIcon className={blockers.length ? "text-negative" : undefined} /> {open.length} hallazgos abiertos
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
                  <span className="hidden xl:inline"> · antes {formatCompact(k.r.contributions_total, "USD")}</span>
                )}
              </p>
            </div>
          ))}
        </section>

        {excluded.length > 0 && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{excluded.join(", ")} excluida del balance consolidado.</span> Su balance no cuadra (
            <Link href={gPath(group, "/findings/FIND-E10")} className="underline underline-offset-2">E10</Link>, diferencia de €50,000). Se muestra tachada por empresa; nunca se compensa en silencio.
          </p>
        )}

        <div className="space-y-3">
          <StatementControls statement={statement} byCompany={byCompany} />
          <StatementTable group={group} rows={facts.rows} companies={companies} byCompany={byCompany} excluded={excluded} />
          <p className="text-xs text-muted-foreground">
            Montos en {facts.currency}, redondeados para mostrar. Consolidado = Σ aportes convertidos + Σ eliminaciones. Abre cualquier línea para rastrearla hasta su celda de origen.
            {statement === "PL" && <> Ingresos antes de eliminaciones: ${formatAmount(row("REVENUE")?.contributions_total ?? "0")}.</>}
          </p>
        </div>
      </PageBody>
    </>
  );
}
