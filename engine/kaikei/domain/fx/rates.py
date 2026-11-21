"""Load the pinned group rate set and translate amounts with Decimal only."""

from __future__ import annotations

import csv
import hashlib
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path

from kaikei.domain.fx.models import FxRate, FxRateSet, RateType, TranslatedRecord

# Keep intermediate precision; round half-even only when a caller asks for reporting scale.
_INTERNAL_QUANTUM = Decimal("0.0000000001")


def _rate_id(rate_set_id: str, from_ccy: str, to_ccy: str, period: str, rate_type: str) -> str:
    raw = f"{rate_set_id}|{from_ccy}|{to_ccy}|{period}|{rate_type}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def load_rate_set(
    path: Path | str,
    *,
    rate_set_id: str = "pinned",
    reporting_currency: str = "USD",
) -> FxRateSet:
    """
    Load a group rate table (`tasas_grupo.csv` columns).

    Fixture columns: currency, rate_type, usd_per_unit, units_per_usd, period, applies_to, source.
    Stored rate = units of reporting currency (USD) per 1 unit of local currency (= usd_per_unit).
    """
    path = Path(path)
    rates: list[FxRate] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            currency = (row.get("currency") or "").strip().upper()
            if not currency:
                continue
            if currency == reporting_currency:
                # Identity row for the reporting currency — keep for completeness.
                period = (row.get("period") or "-").strip()
                rid = _rate_id(rate_set_id, currency, reporting_currency, period, "identity")
                rates.append(
                    FxRate(
                        rate_id=rid,
                        rate_set_id=rate_set_id,
                        from_ccy=currency,
                        to_ccy=reporting_currency,
                        period=period,
                        rate_type=RateType.AVERAGE,  # unused for USD→USD; identity
                        rate=Decimal("1"),
                        source=(row.get("source") or "").strip(),
                        applies_to=(row.get("applies_to") or "").strip(),
                    )
                )
                continue

            rate_type_raw = (row.get("rate_type") or "").strip().lower()
            if rate_type_raw not in (RateType.AVERAGE, RateType.CLOSING):
                raise ValueError(f"unknown rate_type {rate_type_raw!r} for {currency}")
            rate_type = RateType(rate_type_raw)
            period = (row.get("period") or "").strip()
            usd_per_unit = Decimal((row.get("usd_per_unit") or "").strip())
            rid = _rate_id(rate_set_id, currency, reporting_currency, period, rate_type)
            rates.append(
                FxRate(
                    rate_id=rid,
                    rate_set_id=rate_set_id,
                    from_ccy=currency,
                    to_ccy=reporting_currency,
                    period=period,
                    rate_type=rate_type,
                    rate=usd_per_unit,
                    source=(row.get("source") or "").strip(),
                    applies_to=(row.get("applies_to") or "").strip(),
                )
            )
    return FxRateSet(rate_set_id=rate_set_id, reporting_currency=reporting_currency, rates=rates)


def select_rate_period(
    *,
    statement: str,
    scenario_year: str,
    closing_date: str | None = None,
) -> tuple[str, RateType]:
    """
    FX policy (MANIFESTO §4.2):
    - P&L → period average for the scenario year (e.g. "2027" or "2026")
    - Balance sheet → closing rate for the closing date (e.g. "2027-12-31")
    """
    stmt = statement.strip().upper()
    if stmt in ("BS", "BALANCE", "BALANCE_SHEET"):
        period = closing_date or f"{scenario_year}-12-31"
        return period, RateType.CLOSING
    return scenario_year, RateType.AVERAGE


def translate_amount(
    amount_local: Decimal,
    *,
    rate: FxRate,
    run_id: str,
    canonical_record_id: str,
    reporting_decimals: int = 4,
) -> TranslatedRecord:
    """amount_group = amount_local × rate (units of to_ccy per 1 from_ccy)."""
    raw = (amount_local * rate.rate).quantize(_INTERNAL_QUANTUM, rounding=ROUND_HALF_EVEN)
    quantum = Decimal("1").scaleb(-reporting_decimals)
    amount_group = raw.quantize(quantum, rounding=ROUND_HALF_EVEN)
    return TranslatedRecord(
        run_id=run_id,
        canonical_record_id=canonical_record_id,
        fx_rate_id=rate.rate_id,
        amount_local=amount_local,
        amount_group=amount_group,
        currency_local=rate.from_ccy,
        currency_group=rate.to_ccy,
    )
