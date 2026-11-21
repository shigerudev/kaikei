import { formatMinor } from "@/lib/money";
import type { CategoryKind } from "@/lib/data/types";

/** Tabular money text. `signed` shows + for positive amounts (for income/variance). */
export function Money({ minor, currency, signed, className = "" }: { minor: string; currency: string; signed?: boolean; className?: string }) {
  const positive = BigInt(minor) > 0n;
  return <span className={`num whitespace-nowrap ${className}`}>{signed && positive ? "+" : ""}{formatMinor(minor, currency)}</span>;
}

/**
 * Variance with meaning: for expenses, spending above budget is bad (--negative);
 * for income, falling short is bad. Under-target spend stays neutral (minimal palette).
 */
export function Variance({ minor, currency, kind = "expense", className = "" }: { minor: string; currency: string; kind?: CategoryKind; className?: string }) {
  const v = BigInt(minor);
  const bad = kind === "expense" ? v > 0n : v < 0n;
  const label = v === 0n ? "on budget" : kind === "expense" ? (v > 0n ? "over" : "under") : v > 0n ? "above" : "below";
  return (
    <span className={`num inline-flex items-baseline gap-1 whitespace-nowrap ${bad ? "text-negative" : "text-muted-foreground"} ${className}`}>
      {v > 0n ? "+" : ""}
      {formatMinor(minor, currency)}
      <span className="text-[11px] font-normal">{label}</span>
    </span>
  );
}

/** Thin budget bar: fill = actual / budget, clamps at 100% with an overflow marker. Decorative, aria-hidden. */
export function BudgetBar({ actual, budget, kind = "expense" }: { actual: string; budget: string; kind?: CategoryKind }) {
  const a = BigInt(actual);
  const b = BigInt(budget);
  if (b === 0n) return <div aria-hidden className="h-1 w-full rounded-full bg-muted" />;
  const pct = Number((a * 1000n) / b) / 10; // display-only ratio; never shown as a figure
  const over = kind === "expense" && pct > 100;
  return (
    <div aria-hidden className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-negative" : "bg-foreground/70"}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}
