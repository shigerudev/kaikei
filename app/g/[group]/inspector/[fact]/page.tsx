import { ArrowRightIcon, ChevronRightIcon, FileSpreadsheetIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { CompanyTag, SeverityBadge } from "@/components/badges";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { Button } from "@/components/ui/button";
import { dataSource, getCompanies, getFindings, getLineage, getRun } from "@/lib/api";
import { formatAmount, formatPeriod, pluralize } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Inspector" };

/**
 * Screen 6: the trace for one consolidated number (MANIFESTO §4.5): contributions per company → FX rate
 * → eliminations (matches + journals) → findings → source file, row and cell with the raw value.
 */
export default async function InspectorPage({ params }: PageProps<"/g/[group]/inspector/[fact]">) {
  const { group, fact } = await params;
  const result = await load(async () => {
    const [lineage, run, companies] = await Promise.all([getLineage(decodeURIComponent(fact)), getRun(group), getCompanies(group)]);
    const findings = run ? await getFindings(run.id) : [];
    return { lineage, run, companies, findings };
  });

  if (!result.ok || !result.data.lineage) {
    return (
      <>
        <PageHeader group={group} crumbs={[{ label: "Panel", href: gPath(group) }, { label: "Inspector" }]} preview={dataSource() === "preview"} />
        <PageBody>
          {!result.ok ? (
            result.node
          ) : (
            <EmptyState icon={SearchXIcon} title="No pudimos rastrear esa cifra" description="Puede pertenecer a otra ejecución o el enlace está desactualizado.">
              <Button variant="outline" size="sm" asChild>
                <Link href={gPath(group)}>Volver al panel</Link>
              </Button>
            </EmptyState>
          )}
        </PageBody>
      </>
    );
  }

  const { lineage: l, run, companies, findings } = result.data;
  const name = (id: string) => companies.find((c) => c.id === id)?.name ?? id;
  const periodLabel = l.statement === "BS" ? "31 dic 2027" : formatPeriod(l.period, true);
  const dashHref = gPath(group, l.statement === "BS" ? "?statement=BS" : `?period=${l.period}`);
  const related = findings.filter((f) => l.finding_ids.includes(f.id));
  const records = l.contributions.reduce((n, c) => n + c.records.length, 0);
  const rates = new Set(l.contributions.map((c) => c.rate?.id).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        group={group}
        crumbs={[{ label: "Panel", href: gPath(group) }, { label: periodLabel, href: dashHref }, { label: l.name }]}
        run={run}
        preview={dataSource() === "preview"}
      />
      <PageBody className="max-w-5xl">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{l.group_account}</p>
          <h1 className="text-xl font-semibold tracking-tight">{l.name}</h1>
          <p className="text-sm text-muted-foreground">
            {periodLabel} · {l.currency} · ejecución #{run?.number}
          </p>
        </div>

        {/* The formula, with the engine's own totals */}
        <section aria-label="Cómo se construye esta cifra" className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-[1fr_auto_1fr_auto_1.15fr]">
          <Eq label="Σ aportes" value={l.contributions_total} hint={`${pluralize(l.contributions.filter((c) => !c.excluded).length, "empresa")} · ${pluralize(records, "registro")}`} />
          <Op>+</Op>
          <Eq label="Σ eliminaciones" value={l.adjustments_total} hint={pluralize(l.adjustments.length, "asiento")} tone="brand" />
          <Op>=</Op>
          <Eq label="Consolidado" value={l.amount} hint={`${l.currency}, esta ejecución`} strong />
        </section>

        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-label="Trazabilidad">
          {[
            `${pluralize(records, "celda", "celdas")} de origen`,
            `${pluralize(records, "registro canónico", "registros canónicos")}`,
            rates ? `convertidos con ${pluralize(rates, "tasa")}` : "ya en USD",
            `${pluralize(l.adjustments.length, "eliminación", "eliminaciones")}`,
            "1 cifra consolidada",
          ].map((s, i, a) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-md border bg-muted/40 px-2 py-0.5">{s}</span>
              {i < a.length - 1 && <ArrowRightIcon className="size-3" />}
            </li>
          ))}
        </ol>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Aportes por empresa</h2>
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground max-md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <span>Empresa</span>
              <span className="text-right max-md:hidden">Monto local</span>
              <span className="max-md:hidden">Tasa</span>
              <span className="text-right">{l.currency}</span>
            </div>
            {l.contributions.map((c) => (
              <details key={c.company_id} className="group border-b border-border/60 last:border-b-0 [&_summary::-webkit-details-marker]:hidden">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40 max-md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-(--ease-out) group-open:rotate-90" />
                    <CompanyTag id={c.company_id} name={name(c.company_id)} />
                    {c.excluded && <span className="rounded bg-negative/12 px-1.5 text-[10px] text-negative">excluida</span>}
                  </span>
                  <span className="num text-right text-muted-foreground max-md:hidden">
                    {formatAmount(c.amount_local, { dp: 2 })} <span className="text-[11px]">{c.currency}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground max-md:hidden">
                    {c.rate ? (
                      <>
                        {c.rate.rate_type === "average" ? "promedio" : "cierre"} {c.rate.period} · 1 USD = {c.rate.units_per_usd} {c.rate.from_ccy}
                      </>
                    ) : (
                      "Moneda funcional USD"
                    )}
                  </span>
                  <span className={`num text-right font-medium ${c.excluded ? "line-through opacity-50" : ""}`}>{formatAmount(c.amount_group, { dp: 2 })}</span>
                </summary>
                <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {pluralize(c.records.length, "registro")} · cada uno termina en una celda de origen
                  </p>
                  <ul className="space-y-1.5">
                    {c.records.map((r) => (
                      <li key={r.id} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 text-xs sm:grid-cols-[80px_minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                        <span className="num text-muted-foreground">{formatPeriod(r.period)}</span>
                        <span className="flex min-w-0 items-center gap-1.5 font-mono">
                          <FileSpreadsheetIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{r.source.cell}</span>
                        </span>
                        <span className="hidden truncate text-muted-foreground sm:block">
                          {r.local_account !== r.local_name ? `${r.local_account} · ` : ""}
                          {r.local_name}
                        </span>
                        <span className="num text-right">
                          <span className="mr-2 font-mono text-muted-foreground">“{r.source.raw}”</span>
                          {formatAmount(r.amount_group, { dp: 2 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Eliminaciones</h2>
          {l.adjustments.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Ninguna eliminación intercompañía afecta esta cuenta.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {l.adjustments.slice(0, 14).map((a) => (
                <Link
                  key={a.journal_id}
                  href={gPath(group, `/intercompany?match=${a.match_group_id}`)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/40 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <span className="font-mono text-xs">{a.journal_id}</span>
                  <span className="hidden sm:block">
                    {a.flow} · {formatPeriod(a.period)}
                  </span>
                  <span className="hidden text-muted-foreground sm:block">
                    con <CompanyTag id={a.counterparty} /> · {a.rule_id} v{a.rule_version}
                  </span>
                  <span className="num text-right text-brand">({formatAmount(a.amount_group, { dp: 2 })})</span>
                </Link>
              ))}
              {l.adjustments.length > 14 && (
                <Link href={gPath(group, "/intercompany")} className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/40">
                  {l.adjustments.length - 14} asientos más →
                </Link>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Hallazgos que afectan esta cifra</h2>
          {related.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Ninguno. Todos los registros pasaron la validación.</p>
          ) : (
            <ul className="overflow-hidden rounded-xl border">
              {related.map((f) => (
                <li key={f.id}>
                  <Link href={gPath(group, `/findings/${f.id}`)} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/40">
                    <span className="w-10 font-mono text-xs">{f.reference}</span>
                    <SeverityBadge severity={f.severity} />
                    <span className="min-w-0 flex-1 truncate">{f.title}</span>
                    <span className="text-xs text-muted-foreground">{f.status.replace("_", " ").toLowerCase()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

function Eq({ label, value, hint, strong, tone }: { label: string; value: string; hint: string; strong?: boolean; tone?: "brand" }) {
  return (
    <div className={`bg-background p-4 ${strong ? "bg-muted/30" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold tracking-tight ${tone === "brand" ? "text-brand" : ""}`}>${formatAmount(value, { dp: 2 })}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <div className="hidden items-center justify-center bg-background px-1 text-lg text-muted-foreground sm:flex">{children}</div>;
}
