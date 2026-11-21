import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import type { Company, FactRow } from "@/lib/api/types";
import { formatAmount, isZero } from "@/lib/ui/format";
import { gPath } from "@/lib/ui/nav";

/**
 * Consolidated statement: contributions → eliminations → consolidated, per group account.
 * `byCompany` adds one column per company (before eliminations). Every line opens the Inspector.
 * Figures are rendered exactly as the API returns them; subtotals come from the API too.
 */
export function StatementTable({ group, rows, companies, byCompany, excluded = [] }: { group: string; rows: FactRow[]; companies: Company[]; byCompany: boolean; excluded?: string[] }) {
  const cols = byCompany ? companies.length + 3 : 3;
  const grid = { gridTemplateColumns: `minmax(220px,1.6fr) repeat(${cols}, minmax(${byCompany ? 104 : 120}px,1fr))` } as React.CSSProperties;

  return (
    <div className="overflow-x-auto rounded-xl border">
      <div className={byCompany ? "min-w-[1080px]" : "min-w-[600px]"}>
        <div style={grid} className="sticky top-0 grid items-end gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>Cuenta del grupo</span>
          {byCompany &&
            companies.map((c) => (
              <span key={c.id} className="text-right">
                <span className="block font-mono text-[10px]">{c.id}</span>
                <span className={`block truncate ${excluded.includes(c.id) ? "line-through decoration-negative/60" : ""}`}>{c.name.replace(/^AG /, "")}</span>
              </span>
            ))}
          <span className="text-right">{byCompany ? "Σ aportes" : "Aportes"}</span>
          <span className="text-right">Eliminaciones</span>
          <span className="text-right text-foreground">Consolidado</span>
        </div>
        {rows.map((r, i) => {
          const line = r.kind === "line";
          const total = r.kind === "total";
          const body = (
            <>
              <span className={`flex min-w-0 items-center gap-1.5 ${line ? "pl-3" : ""}`}>
                <span className={`truncate ${line ? "" : "font-medium"}`}>{r.name}</span>
                {line && <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
              </span>
              {byCompany &&
                companies.map((c) => (
                  <Num key={c.id} value={r.by_company[c.id]} muted dim={excluded.includes(c.id)} />
                ))}
              <Num value={r.contributions_total} muted />
              <Num value={r.adjustments_total} adjustment />
              <Num value={r.amount} strong={!line} />
            </>
          );
          const cls = `grid items-center gap-3 px-4 text-sm ${line ? "py-2" : "py-2.5"} ${total ? "border-t border-foreground/15 bg-muted/25" : r.kind === "subtotal" ? "border-t border-border/70" : ""}`;
          return line ? (
            <Link
              key={r.id}
              href={gPath(group, `/inspector/${r.id}`)}
              style={{ ...grid, "--i": Math.min(i, 10) } as React.CSSProperties}
              className={`group enter ${cls} transition-colors hover:bg-muted/40 focus-visible:bg-brand-subtle/60 focus-visible:outline-none`}
            >
              {body}
            </Link>
          ) : (
            <div key={r.id} style={{ ...grid, "--i": Math.min(i, 10) } as React.CSSProperties} className={`enter ${cls}`}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Num({ value, muted, strong, adjustment, dim }: { value?: string; muted?: boolean; strong?: boolean; adjustment?: boolean; dim?: boolean }) {
  if (value === undefined || isZero(value)) return <span className="num text-right text-muted-foreground/50">—</span>;
  return (
    <span className={`num text-right ${strong ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""} ${adjustment ? "text-brand" : ""} ${dim ? "opacity-40" : ""}`}>
      {formatAmount(value)}
    </span>
  );
}
