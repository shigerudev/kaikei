/**
 * Money helpers. Principle 6: amounts are integer minor units + ISO currency. No floats, ever.
 */
import { notImplemented } from "@/lib/not-implemented";

/** Minor digits per currency. Every currency in the CA research uses 2. */
const MINOR_DIGITS: Record<string, number> = {};
const minorDigits = (currency: string) => MINOR_DIGITS[currency] ?? 2;

/** Display only. 330000n GTQ → "Q3,300.00". Never parse this back. */
export function formatMinor(amountMinor: bigint | string, currency: string, locale = "es-GT") {
  const minor = BigInt(amountMinor);
  const digits = minorDigits(currency);
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const base = 10n ** BigInt(digits);
  const major = abs / base;
  const frac = (abs % base).toString().padStart(digits, "0");
  // Format the integer part via Intl using a string (avoids float conversion), then append the fraction.
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency;
  const grouped = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "−" : ""}${symbol}${grouped}${digits ? `.${frac}` : ""}`;
}

/**
 * Parse an owner-typed amount into signed minor units, or null if unparseable
 * (the caller then raises a `parse_error` flag; the row is never dropped).
 * Must handle: "1,200.00", "1.200,00", "Q 600", "(600)", "-600", "600-".
 * Must reject: "Q 1,2O0" (letter O), empty strings.
 * TODO(Jose): implement + unit-test the edge cases above.
 */
export function parseAmountToMinor(raw: string, currency: string): bigint | null {
  void raw;
  void currency;
  return notImplemented("money.parseAmountToMinor", "Jose");
}
