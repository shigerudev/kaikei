import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { CompanyTag, MatchStatusBadge } from "@/components/badges";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { load } from "@/components/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataSource, getReconciliations, getRun } from "@/lib/api";
import type { MatchGroup } from "@/lib/api/types";
import { formatAmount, formatPeriod } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Intercompañía" };

/**
 * Intercompany reconciliation: matches are evidence, eliminations are separate balanced journals
 * (PLAN ADR-005). Mismatches and one-sided pairs are listed and never eliminated silently.
 */
export default async function IntercompanyPage({ params, searchParams }: PageProps<"/g/[group]/intercompany">) {
  const { group } = await params;
  const sp = await searchParams;
  const show = sp.show === "matched" ? "matched" : sp.show === "all" ? "all" : "exceptions";
  const highlight = typeof sp.match === "string" ? sp.match : null;
  const result = await load(async () => {
    const run = await getRun(group);
    return { run, rec: run ? await getReconciliations(run.id) : { matches: [], journals: [] } };
  });

  if (!result.ok)
    return (
      <>
        <PageHeader group={group} crumbs={[{ label: "Intercompañía" }]} preview={dataSource() === "preview"} />
        <PageBody>{result.node}</PageBody>
      </>
    );

  const { run, rec } = result.data;
  const journalOf = new Map(rec.journals.map((j) => [j.id, j]));
  const exceptions = rec.matches.filter((m) => m.status !== "MATCHED");
  const flows = [...new Set(rec.matches.map((m) => m.flow))];
  const focus = highlight ? rec.matches.find((m) => m.id === highlight) : null;
  const list = (focus ? [focus] : show === "exceptions" ? exceptions : show === "matched" ? rec.matches.filter((m) => m.status === "MATCHED") : rec.matches).slice(0, 120);

  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Intercompañía" }]} run={run} preview={dataSource() === "preview"} />
      <PageBody className="max-w-6xl">
        <PageTitle
          title="Intercompañía"
          description="Las contrapartes se identifican con la tabla de alias y se concilian por periodo tras la conversión, dentro de la tolerancia del grupo. La conciliación es evidencia; la eliminación es un asiento balanceado aparte."
        />

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
          {[
            ["Pares conciliados", rec.matches.filter((m) => m.status === "MATCHED").length, ""],
            ["Con diferencia", rec.matches.filter((m) => m.status === "MISMATCH").length, "text-warning"],
            ["Sin contraparte", rec.matches.filter((m) => m.status === "ONE_SIDED").length, "text-warning"],
            ["Asientos balanceados", rec.journals.length, ""],
          ].map(([k, v, cls]) => (
            <div key={k as string} className="bg-background p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className={`num mt-1 text-2xl font-semibold ${v ? cls : ""}`}>{v}</p>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {focus ? (
            <p className="text-sm">
              Mostrando <span className="font-mono text-xs">{focus.id}</span> ·{" "}
              <Link href={gPath(group, "/intercompany")} className="text-muted-foreground underline underline-offset-2">
                ver todas las excepciones
              </Link>
            </p>
          ) : (
            <Tabs value={show}>
              <TabsList>
                {(["exceptions", "matched", "all"] as const).map((s) => (
                  <TabsTrigger key={s} value={s} asChild>
                    <Link href={gPath(group, `/intercompany${s === "exceptions" ? "" : `?show=${s}`}`)} scroll={false} className="capitalize">
                      {s === "exceptions" ? `Excepciones (${exceptions.length})` : s === "matched" ? "Conciliados" : "Todos"}
                    </Link>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <p className="text-xs text-muted-foreground">Flujos: {flows.join(" · ")}</p>
        </div>

        <ul className="space-y-3">
          {list.map((m, i) => (
            <MatchCard key={m.id} group={group} m={m} journal={m.journal_id ? journalOf.get(m.journal_id) ?? null : null} i={i} highlight={m.id === highlight} />
          ))}
        </ul>
        {!focus && list.length === 120 && <p className="text-xs text-muted-foreground">Se muestran los primeros 120 pares.</p>}
      </PageBody>
    </>
  );
}

function MatchCard({ group, m, journal, i, highlight }: { group: string; m: MatchGroup; journal: { id: string; lines: { group_account: string; company_id: string; debit: string; credit: string }[]; rule_id: string; rule_version: string } | null; i: number; highlight: boolean }) {
  return (
    <li style={{ "--i": Math.min(i, 8) } as React.CSSProperties} className={`enter overflow-hidden rounded-xl border ${highlight ? "ring-3 ring-brand/20" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs">
        <MatchStatusBadge status={m.status} />
        <span className="font-medium">{m.flow}</span>
        <span className="text-muted-foreground">{formatPeriod(m.period)}</span>
        <span className="ml-auto font-mono text-muted-foreground">{m.id}</span>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-[1fr_auto_1fr]">
        <Side label="Vendedor" side={m.seller} />
        <div className="hidden items-center justify-center bg-background px-2 sm:flex">
          <ArrowRightIcon className="size-4 text-muted-foreground" />
        </div>
        <Side label="Comprador" side={m.buyer} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>
          Diferencia <span className={`num ${m.status === "MATCHED" ? "" : "font-medium text-warning"}`}>${formatAmount(m.difference, { dp: 2 })}</span> · tolerancia ${formatAmount(m.tolerance, { dp: 2 })}
        </span>
        {journal ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{journal.id}</span>
            {journal.lines.map((l, k) => (
              <span key={k} className="num">
                {l.debit !== "0.0000" ? "Debe" : "Haber"} {l.group_account} {formatAmount(l.debit !== "0.0000" ? l.debit : l.credit, { dp: 2 })}
              </span>
            ))}
            <span>· {journal.rule_id} v{journal.rule_version}</span>
          </span>
        ) : (
          <span className="font-medium text-foreground">No eliminado</span>
        )}
        {m.finding_id && (
          <Link href={gPath(group, `/findings/${m.finding_id}`)} className="ml-auto underline underline-offset-2">
            Ver hallazgo
          </Link>
        )}
      </div>
    </li>
  );
}

function Side({ label, side }: { label: string; side: MatchGroup["seller"] | null }) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {side ? (
        <>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <CompanyTag id={side.company_id} />
            <span className="font-mono text-xs text-muted-foreground">{side.group_account}</span>
          </p>
          <p className="num mt-1.5 text-sm">
            {formatAmount(side.amount_local, { dp: 2 })} {side.currency} <span className="text-muted-foreground">= ${formatAmount(side.amount_group, { dp: 2 })}</span>
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{side.source.cell}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Sin registro recíproco.</p>
      )}
    </div>
  );
}
