"""Locale-aware number, money, date and period parsing (PLAN §6.4 PARSER-002).

Pure stdlib. No float anywhere. Ambiguous input returns a status, never a guess.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

# ---- ISO 4217 -------------------------------------------------------------

_ZERO_DECIMAL = frozenset(
    "BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF".split()
)
_THREE_DECIMAL = frozenset("BHD IQD JOD KWD LYD OMR TND".split())
_TWO_DECIMAL = frozenset(
    """AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BMD BND BOB BRL BSD BTN BWP BYN
    BZD CAD CDF CHF CNY COP CRC CUP CVE CZK DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP
    GMD GTQ GYD HKD HNL HTG HUF IDR ILS INR IRR JMD KES KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL
    MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK
    PHP PKR PLN QAR RON RSD RUB SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB
    TJS TMT TOP TRY TTD TWD TZS UAH USD UYU UZS VES WST XCD YER ZAR ZMW ZWL""".split()
)
ISO_4217: frozenset[str] = _ZERO_DECIMAL | _THREE_DECIMAL | _TWO_DECIMAL

# Symbol -> ISO code. "$" is ambiguous in the real world; the group reports in USD, so it is
# accepted for USD only (anything else is a currency mismatch, never a silent re-label).
SYMBOL_CURRENCY: dict[str, str] = {"Q": "GTQ", "€": "EUR", "$": "USD", "US$": "USD", "£": "GBP"}


def is_iso_currency(code: str) -> bool:
    return code in ISO_4217


def currency_decimals(code: str) -> int:
    """Minor-unit exponent of an ISO 4217 currency."""
    if code not in ISO_4217:
        raise ValueError(f"not an ISO 4217 currency: {code!r}")
    if code in _ZERO_DECIMAL:
        return 0
    return 3 if code in _THREE_DECIMAL else 2


# ---- locale hints ---------------------------------------------------------

_REGION_DECIMAL = {
    "ES": ",", "DE": ",", "FR": ",", "IT": ",", "PT": ",", "BR": ",", "AR": ",", "CL": ",",
    "CO": ",", "GT": ".", "SV": ".", "PA": ".", "US": ".", "GB": ".", "MX": ".", "HN": ".",
    "NI": ".", "CR": ".",
}  # fmt: skip
_LANG_DECIMAL = {"en": ".", "es": ",", "de": ",", "fr": ",", "it": ",", "pt": ","}


def decimal_char(locale_hint: str | None) -> str | None:
    """Decimal separator implied by a hint (`es_GT`, `en`, `decimal_comma`, ...) or None."""
    if locale_hint is None:
        return None
    h = locale_hint.strip().lower()
    if h == "decimal_comma":
        return ","
    if h == "decimal_dot":
        return "."
    parts = re.split(r"[_-]", h)
    if len(parts) > 1 and parts[1].upper() in _REGION_DECIMAL:
        return _REGION_DECIMAL[parts[1].upper()]
    if parts[0] in _LANG_DECIMAL:
        return _LANG_DECIMAL[parts[0]]
    raise ValueError(f"unknown numeric locale hint: {locale_hint!r}")


# ---- decimals -------------------------------------------------------------


@dataclass(frozen=True)
class DecimalParse:
    value: Decimal | None
    status: str  # ok|blank|placeholder|ambiguous|invalid|formula_like|locale_mismatch
    reason: str = ""


_GROUP_SEPS = "   '’"
_SYMBOL_RE = re.compile(r"^(?:US\$|USD|EUR|GTQ|PAB|GBP|Q|\$|€|£)\s*")
_SYMBOL_END_RE = re.compile(r"\s*(?:US\$|USD|EUR|GTQ|PAB|GBP|Q|\$|€|£)$")
_PLACEHOLDERS = {"-", "–", "—", "n/a", "na", "n.a."}


def _strip(raw: str) -> tuple[str, bool, str | None]:
    """Remove parentheses / signs / currency symbols. Returns (body, negative, symbol)."""
    s = raw.strip()
    neg = False
    symbol: str | None = None
    if s.startswith("(") and s.endswith(")"):
        neg, s = True, s[1:-1].strip()
    for _ in range(4):
        before = s
        if s[:1] in ("+", "-"):
            neg ^= s[0] == "-"
            s = s[1:].strip()
        elif s[-1:] in ("+", "-"):
            neg ^= s[-1] == "-"
            s = s[:-1].strip()
        m = _SYMBOL_RE.match(s)
        if m:
            symbol, s = m.group(0).strip(), s[m.end() :].strip()
        else:
            m = _SYMBOL_END_RE.search(s)
            if m:
                symbol, s = m.group(0).strip(), s[: m.start()].strip()
        if s == before:
            break
    return s, neg, symbol


def _parse(raw: str, locale_hint: str | None) -> tuple[DecimalParse, str | None]:
    if not raw.strip():
        return DecimalParse(None, "blank"), None
    text = raw.strip()
    if text.lower() in _PLACEHOLDERS:
        return DecimalParse(None, "placeholder", "dash/placeholder is not assumed to be zero"), None
    dec = decimal_char(locale_hint)
    body, neg, symbol = _strip(text)
    result = _body(body, neg, dec)
    if result.value is None and result.status == "invalid" and text[0] in "=+-@":
        return DecimalParse(None, "formula_like", "text starting with =,+,-,@ kept as text"), symbol
    return result, symbol


def _groups_ok(s: str, sep: str) -> bool:
    return bool(re.fullmatch(rf"\d{{1,3}}(?:\{sep}\d{{3}})+", s))


def _body(body: str, neg: bool, dec: str | None) -> DecimalParse:  # noqa: PLR0911
    if not body:
        return DecimalParse(None, "invalid", "no digits")
    if any(c in body for c in _GROUP_SEPS):
        if not re.fullmatch(rf"\d{{1,3}}(?:[{_GROUP_SEPS}]\d{{3}})+(?:[.,]\d+)?", body):
            return DecimalParse(None, "invalid", "misplaced group separator")
        body = re.sub(rf"(?<=\d)[{_GROUP_SEPS}](?=\d{{3}})", "", body)
    if not re.fullmatch(r"[\d.,]+", body) or not re.search(r"\d", body):
        return DecimalParse(None, "invalid", "non-numeric characters")
    if body[-1] in ".," or body[0] in ".,":
        return DecimalParse(None, "invalid", "dangling separator")
    sign = -1 if neg else 1
    commas, dots = body.count(","), body.count(".")
    if not commas and not dots:
        return DecimalParse(Decimal(body) * sign, "ok")
    mismatch = False
    if commas and dots:
        dc = "," if body.rfind(",") > body.rfind(".") else "."
        tc = "." if dc == "," else ","
        if body.count(dc) != 1:
            return DecimalParse(None, "invalid", "repeated decimal separator")
        left, right = body.split(dc)
        if not _groups_ok(left, tc):
            return DecimalParse(None, "invalid", "malformed thousands groups")
        mismatch = dec is not None and dec != dc
        num = left.replace(tc, "") + "." + right
    else:
        c = "," if commas else "."
        if body.count(c) > 1:
            if not _groups_ok(body, c) or dec == c:
                return DecimalParse(None, "invalid", "malformed thousands groups")
            num = body.replace(c, "")
        else:
            left, right = body.split(c)
            thousands_possible = len(right) == 3 and re.fullmatch(r"[1-9]\d{0,2}", left)
            if thousands_possible and dec is None:
                return DecimalParse(
                    None, "ambiguous", f"'{body}' is thousands or decimal; locale hint needed"
                )
            if thousands_possible and dec != c:
                num = left + right
            else:
                num = left + "." + right
                mismatch = dec is not None and dec != c
    return DecimalParse(
        Decimal(num) * sign,
        "locale_mismatch" if mismatch else "ok",
        "separator contradicts the declared numeric locale" if mismatch else "",
    )


def parse_decimal_ex(raw: str | None, locale_hint: str | None = None) -> DecimalParse:
    """Parse with a status. Value is None unless status is `ok` or `locale_mismatch`."""
    return _parse(raw or "", locale_hint)[0]


def parse_decimal(raw: str | None, locale_hint: str | None = None) -> Decimal | None:
    """Decimal or None (blank, placeholder, ambiguous, invalid). Never a guess, never zero."""
    return parse_decimal_ex(raw, locale_hint).value


@dataclass(frozen=True)
class MoneyParse:
    value: Decimal | None
    status: str  # DecimalParse statuses + currency_mismatch|bad_currency|too_many_decimals
    reason: str = ""
    symbol_currency: str | None = None


def parse_money(raw: str | None, currency: str, locale_hint: str | None = None) -> MoneyParse:
    """Parse an amount for a row currency: ISO 4217 only, symbol must match, per-currency decimals.

    `600-`, `-600`, `(600)` are negative; `Q 1,2O0` (letter O) is invalid; `Q 600` on a USD row
    is a currency mismatch; more fraction digits than the currency allows is rejected, not rounded.
    """
    if not is_iso_currency(currency):
        return MoneyParse(None, "bad_currency", f"{currency!r} is not an ISO 4217 code")
    parsed, symbol = _parse(raw or "", locale_hint)
    sym_ccy = None
    if symbol:
        sym_ccy = SYMBOL_CURRENCY.get(symbol, symbol if symbol in ISO_4217 else None)
        if sym_ccy != currency:
            return MoneyParse(
                None, "currency_mismatch", f"symbol {symbol!r} does not match {currency}", sym_ccy
            )
    if parsed.value is not None and -parsed.value.as_tuple().exponent > currency_decimals(currency):
        return MoneyParse(
            None,
            "too_many_decimals",
            f"{currency} allows {currency_decimals(currency)} decimals",
            sym_ccy,
        )
    return MoneyParse(parsed.value, parsed.status, parsed.reason, sym_ccy)


# ---- months, dates, periods ----------------------------------------------


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


_MONTHS: dict[str, int] = {}
for _i, _names in enumerate(
    [
        "ene enero jan january",
        "feb febrero february",
        "mar marzo march",
        "abr abril apr april",
        "may mayo",
        "jun junio june",
        "jul julio july",
        "ago agosto aug august",
        "sep sept set septiembre setiembre september",
        "oct octubre october",
        "nov noviembre november",
        "dic diciembre dec december",
    ],
    start=1,
):
    for _n in _names.split():
        _MONTHS[_n] = _i


def month_from_label(label: str) -> int | None:
    """Spanish/English month label (`Ene`, `sept`, `Diciembre`, `Dec`) -> 1..12."""
    return _MONTHS.get(_norm(label).rstrip("."))


def parse_date(raw: str | None) -> date | None:
    """`dd/mm/yyyy`, `dd-Mon-yyyy` (ES/EN month), `yyyy-mm-dd`. Else None (never guesses)."""
    if not raw:
        return None
    s = _norm(raw)
    try:
        if m := re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", s):
            return date(int(m[3]), int(m[2]), int(m[1]))
        if m := re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", s):
            return date(int(m[1]), int(m[2]), int(m[3]))
        if m := re.fullmatch(r"(\d{1,2})[-\s]([a-z]+)\.?[-\s](\d{4})", s):
            mon = _MONTHS.get(m[2])
            return date(int(m[3]), mon, int(m[1])) if mon else None
    except ValueError:
        return None
    return None


def parse_period(raw: str | None) -> str | None:
    """`YYYY-MM` from `YYYY-MM`, `ene-2027`, or any parse_date format. Else None."""
    if not raw:
        return None
    s = _norm(raw)
    if m := re.fullmatch(r"(?:(?:total|fy|real|actual|ano)\s*)?(\d{4})", s):
        return m[1]  # annual period (e.g. 2026 actuals)
    if m := re.fullmatch(r"(\d{4})-(\d{2})", s):
        return f"{m[1]}-{m[2]}" if 1 <= int(m[2]) <= 12 else None
    if m := re.fullmatch(r"([a-z]+)\.?[-\s/](\d{4})", s):
        mon = _MONTHS.get(m[1])
        return f"{m[2]}-{mon:02d}" if mon else None
    d = parse_date(raw)
    return f"{d.year}-{d.month:02d}" if d else None
