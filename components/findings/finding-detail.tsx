import { FileSpreadsheetIcon } from "lucide-react";
import Link from "next/link";
import { CompanyTag, FindingStatusText, MatchStatusBadge, SeverityBadge } from "@/components/badges";
import { DecisionPanel } from "@/components/findings/decision-panel";
import type { Company, Finding, MatchGroup } from "@/lib/api/types";
import { formatAmount, formatPeriod } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

/** Finding body shared by the sheet and the full page: what, where, the numbers, IC sides, decision. */
export function FindingDetail({ group, finding: f, match, companies }: { group: string; finding: Finding; match: MatchGroup | null; companies: Company[] }) {
  const name = (id: string) => companies.find((c) => c.id === id)?.name ?? id;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={f.severity} />
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{f.rule_id}</span>
        <span className="text-xs text-muted-foreground">v{f.rule_version}</span>
        <span className="ml-auto">
          <FindingStatusText status={f.status} />
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-sm leading-relaxed">{f.reason}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Expected behaviour:</span> {f.expected_behavior}.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {f.company_ids.map((c) => (
            <CompanyTag key={c} id={c} name={name(c)} />
          ))}
        </div>
      </div>

      {(f.expected || f.observed) && (
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border text-sm">
          {[
            ["Expected", f.expected],
            ["Observed", f.observed],
            ["Difference", f.difference],
          ].map(([k, v]) => (
            <div key={k} className="bg-background p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className={`num mt-1 font-medium ${k === "Difference" && v ? "text-negative" : ""}`}>
                {v ? `${formatAmount(v, { dp: 2 })} ${f.currency ?? ""}` : "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Location</h3>
        <ul className="space-y-1.5">
          {f.source_refs.map((s, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs">
              <FileSpreadsheetIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{s.filename}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">{s.row ? `line ${s.row}${s.column ? `, column ${s.column}` : ""}` : s.note}</span>
            </li>
          ))}
        </ul>
      </section>

      {match && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Intercompany pair · {formatPeriod(match.period)}</h3>
            <MatchStatusBadge status={match.status} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Seller", match.seller],
              ["Buyer", match.buyer],
            ].map(([label, side]) => (
              <div key={label as string} className={`rounded-xl border p-3 ${side ? "" : "border-dashed"}`}>
                <p className="text-xs text-muted-foreground">{label as string}</p>
                {side && typeof side === "object" ? (
                  <>
                    <p className="mt-1 text-sm">
                      <CompanyTag id={side.company_id} name={name(side.company_id)} />
                    </p>
                    <p className="num mt-2 text-lg font-semibold">
                      {formatAmount(side.amount_local, { dp: 2 })} <span className="text-xs font-normal text-muted-foreground">{side.currency}</span>
                    </p>
                    <p className="num text-xs text-muted-foreground">= ${formatAmount(side.amount_group, { dp: 2 })} USD</p>
                    <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{side.source.cell}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No matching record. Not eliminated.</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Difference after conversion ${formatAmount(match.difference, { dp: 2 })} · tolerance ${formatAmount(match.tolerance, { dp: 2 })} ·{" "}
            <Link href={gPath(group, `/intercompany?match=${match.id}`)} className="underline underline-offset-2">
              open in Intercompany
            </Link>
          </p>
        </section>
      )}

      <DecisionPanel group={group} finding={f} />
    </div>
  );
}
