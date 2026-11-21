/**
 * Display formatting (owner: Jordi). Pure string work so server and client render identical text.
 * Decimal amounts arrive as strings from the API; rounding here is display-only (half-even at the
 * reporting boundary, MANIFESTO §4.2) and never feeds back into a figure.
 */
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2027" → "Año 2027"; "2027-03" → "mar 2027" (o "marzo 2027"). */
export function formatPeriod(period: string, long = false) {
  if (/^\d{4}$/.test(period)) return `Año ${period}`;
  const [y, m] = period.split("-");
  return `${(long ? MONTHS_LONG : MONTHS)[Number(m) - 1] ?? m} ${y}`;
}

/** ISO timestamp → "21 Nov, 15:20" (UTC−6, Guatemala; fixed so SSR and client agree). */
export function formatStamp(iso: string) {
  const t = new Date(Date.parse(iso) - 6 * 60 * 60 * 1000);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}, ${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Round a decimal string half-even to `dp` places, returning [negative, integerDigits, fractionDigits]. */
function roundParts(value: string, dp: number): [boolean, string, string] {
  let s = value.trim();
  const neg = s.startsWith("-");
  if (neg || s.startsWith("+")) s = s.slice(1);
  const [intRaw = "0", fracRaw = ""] = s.split(".");
  const digits = BigInt((intRaw || "0") + fracRaw.padEnd(dp + 1, "0").slice(0, dp + 1));
  const rest = fracRaw.slice(dp + 1).replace(/0+$/, "");
  let q = digits / 10n;
  const last = digits % 10n;
  if (last > 5n || (last === 5n && (rest.length > 0 || q % 2n === 1n))) q += 1n;
  const str = q.toString().padStart(dp + 1, "0");
  const int = dp ? str.slice(0, -dp) : str;
  const frac = dp ? str.slice(-dp) : "";
  const isZero = /^0*$/.test(int + frac);
  return [neg && !isZero, int.replace(/^0+(?=\d)/, ""), frac];
}

const group3 = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const SYMBOL: Record<string, string> = { USD: "$", GTQ: "Q", EUR: "€" };

/**
 * Accounting display: `1,234,567` with optional currency symbol; negatives in parentheses (statements)
 * or with a minus sign (`style: "minus"`).
 */
export function formatAmount(value: string, opts: { currency?: string; dp?: number; style?: "parens" | "minus"; symbol?: boolean; signed?: boolean } = {}) {
  const { currency, dp = 0, style = "parens", symbol = false, signed = false } = opts;
  const [neg, int, frac] = roundParts(value, dp);
  const body = `${symbol && currency ? SYMBOL[currency] ?? `${currency} ` : ""}${group3(int)}${dp ? `.${frac}` : ""}`;
  if (neg) return style === "parens" ? `(${body})` : `−${body}`;
  return signed && !/^[0.,]*$/.test(int + frac) ? `+${body}` : body;
}

export const isNegative = (value: string) => value.trim().startsWith("-") && !/^-?0*\.?0*$/.test(value.trim());
export const isZero = (value: string) => /^[-+]?0*\.?0*$/.test(value.trim());

/** Compact for KPIs: 18.4M, 735.0K. Display only. */
export function formatCompact(value: string, currency?: string) {
  const [neg, int] = roundParts(value, 0);
  const n = int.length;
  const sym = currency ? SYMBOL[currency] ?? "" : "";
  const fmt = (digits: number, suffix: string) => {
    const whole = int.slice(0, n - digits) || "0";
    const dec = int.slice(n - digits, n - digits + 1) || "0";
    return `${neg ? "−" : ""}${sym}${whole}.${dec}${suffix}`;
  };
  if (n > 9) return fmt(9, "B");
  if (n > 6) return fmt(6, "M");
  if (n > 3) return fmt(3, "K");
  return `${neg ? "−" : ""}${sym}${int}`;
}

export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;
