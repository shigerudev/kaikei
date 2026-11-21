import { CheckIcon, CircleDashedIcon, OctagonXIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { RunStatusBadge } from "@/components/badges";
import { CopyField } from "@/components/copy-field";
import { RunBanner } from "@/components/runs/run-banner";
import { StartRunButton } from "@/components/runs/run-actions";
import { PageBody, PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState, load } from "@/components/states";
import { dataSource, getFindings, getRun, getRuns } from "@/lib/api";
import type { RunStage } from "@/lib/api/types";
import { formatStamp, shortHash } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

export const metadata = { title: "Ejecución" };

const STAGE_ICON: Record<RunStage["status"], { Icon: typeof CheckIcon; cls: string }> = {
  done: { Icon: CheckIcon, cls: "bg-foreground text-background" },
  warning: { Icon: TriangleAlertIcon, cls: "bg-warning/15 text-warning" },
  blocked: { Icon: OctagonXIcon, cls: "bg-negative/12 text-negative" },
  pending: { Icon: CircleDashedIcon, cls: "bg-muted text-muted-foreground" },
};

/** Screen 3: one run — stages in order, counts, pinned versions, fingerprint, gate. */
export default async function RunPage({ params }: PageProps<"/g/[group]/runs/[run]">) {
  const { group, run: runId } = await params;
  const result = await load(async () => {
    const [run, runs] = await Promise.all([getRun(group, runId), getRuns(group)]);
    return { run, runs, findings: run ? await getFindings(run.id) : [] };
  });
  const run = result.ok ? result.data.run : null;

  return (
    <>
      <PageHeader group={group} crumbs={[{ label: "Ejecuciones", href: gPath(group, "/runs") }, { label: run ? `Ejecución #${run.number}` : runId }]} run={run} preview={dataSource() === "preview"} />
      <PageBody className="max-w-4xl">
        {!result.ok ? (
          result.node
        ) : !run ? (
          <EmptyState icon={SearchXIcon} title="Ejecución no encontrada" />
        ) : (
          <>
            <PageTitle
              title={`Ejecución #${run.number}`}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <RunStatusBadge status={run.status} /> {formatStamp(run.created_at)} · {run.reason}
                </span>
              }
            >
              {run.id === result.data.runs[0]?.id && <StartRunButton group={group} />}
            </PageTitle>

            {run.id === result.data.runs[0]?.id && (
              <RunBanner group={group} run={run} blockers={result.data.findings.filter((f) => f.severity === "BLOCKER" && (f.status === "OPEN" || f.status === "UNDER_REVIEW"))} />
            )}

            <section className="space-y-3">
              <h2 className="text-sm font-medium">Etapas</h2>
              <ol className="relative space-y-0">
                {run.stages.map((s, i) => {
                  const { Icon, cls } = STAGE_ICON[s.status];
                  return (
                    <li key={s.key} style={{ "--i": i } as React.CSSProperties} className="enter relative flex gap-4 pb-5 last:pb-0">
                      {i < run.stages.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-border" />}
                      <span className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ${cls}`}>
                        <Icon className="size-3.5" />
                      </span>
                      <div className="pt-0.5">
                        <p className="text-sm font-medium">
                          {i + 1}. {s.label}
                        </p>
                        <p className="text-sm text-muted-foreground">{s.detail}</p>
                        {s.status === "blocked" && (
                          <Link href={gPath(group, "/findings?severity=BLOCKER")} className="text-xs underline underline-offset-2">
                            Ver bloqueantes
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium">Entradas fijadas</h2>
              <div className="overflow-hidden rounded-xl border text-sm">
                {run.inputs.files.map((f) => (
                  <div key={f.company_id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-2">
                    <span className="font-mono text-xs text-muted-foreground">{f.company_id}</span>
                    <span className="truncate font-mono text-xs">{f.filename}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{shortHash(f.sha256)}</span>
                  </div>
                ))}
                <div className="grid gap-px bg-border sm:grid-cols-3">
                  {[
                    ["Mapeo", run.inputs.mapping_version],
                    ["Tasas", run.inputs.rate_set_id],
                    ["Reglas", run.inputs.rule_set_version],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-background px-4 py-2.5">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-mono text-xs">{v}</p>
                    </div>
                  ))}
                </div>
                {run.inputs.decisions.length > 0 && (
                  <div className="border-t px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">Decisiones incluidas</p>
                    <p className="font-mono text-xs">{run.inputs.decisions.join(" · ")}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-medium">Huella</h2>
              <CopyField value={run.fingerprint} label="huella de la ejecución" />
              <p className="text-xs text-muted-foreground">SHA-256 de las entradas en orden. Reejecutar con las mismas entradas y versiones da la misma huella y totales idénticos.</p>
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}
