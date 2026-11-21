/** Dashboard periods in display order: months of the budget year, then the full year (default). */
export const BUDGET_YEAR = "2027";
export const PERIODS = [...Array.from({ length: 12 }, (_, i) => `${BUDGET_YEAR}-${String(i + 1).padStart(2, "0")}`), BUDGET_YEAR];

export function resolvePeriod(requested: string | string[] | undefined) {
  return typeof requested === "string" && PERIODS.includes(requested) ? requested : BUDGET_YEAR;
}
