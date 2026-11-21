/**
 * Display formatting for dates and periods (owner: Jordi). Pure string work with fixed month names,
 * so server and client render identical text (no locale/timezone hydration drift).
 * Money is formatted only by `formatMinor` in lib/money.ts.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11" → "Nov 2026" (or "November 2026" with long). */
export function formatPeriod(period: string, long = false) {
  const [y, m] = period.split("-");
  const idx = Number(m) - 1;
  return `${(long ? MONTHS_LONG : MONTHS)[idx] ?? m} ${y}`;
}

/** "2026-11-18" → "18 Nov" (or "18 Nov 2026" with year). */
export function formatDate(date: string, withYear = false) {
  const [y, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}${withYear ? ` ${y}` : ""}`;
}

/** ISO timestamp → "18 Nov, 14:02" in Guatemala time (UTC−6, no DST). */
export function formatStamp(iso: string) {
  const t = new Date(Date.parse(iso) - 6 * 60 * 60 * 1000);
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}, ${hh}:${mm}`;
}

export function shiftPeriod(period: string, delta: number) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const d = y * 12 + (m - 1) + delta;
  return `${Math.floor(d / 12)}-${String((d % 12) + 1).padStart(2, "0")}`;
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
