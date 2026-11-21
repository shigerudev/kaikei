"""Batch FX translation by statement + scenario (PIPER-67 / AC4)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from kaikei.domain.fx.models import FxRateSet, RateType, TranslatedRecord
from kaikei.domain.fx.rates import select_rate_period, translate_amount
from kaikei.domain.intercompany.aliases import Entity


@dataclass(frozen=True)
class CanonicalAmount:
    """Minimal shape until Jose's CanonicalRecord (PIPER-58/65) lands."""

    record_id: str
    company_id: str
    currency: str
    amount_local: Decimal
    statement: str  # "PL" | "BS"
    scenario_year: str  # "2027" budget or "2026" actuals
    period: str  # YYYY-MM or YYYY-MM-DD
    local_fx_rate: Decimal | None = None  # rate claimed inside the source file, if any


@dataclass(frozen=True)
class FxFinding:
    """Lightweight finding until Jose's Finding model (K4) is shared."""

    rule_id: str
    severity: str
    record_id: str
    reason: str
    expected: str | None = None
    observed: str | None = None


@dataclass(frozen=True)
class TranslationResult:
    translated: list[TranslatedRecord]
    findings: list[FxFinding]
    missing_rate_record_ids: list[str]


def entity_currency(company_id: str, entities: list[Entity]) -> str | None:
    for ent in entities:
        if ent.entity_id == company_id:
            return ent.currency
    return None


def translate_records(
    records: list[CanonicalAmount],
    *,
    rate_set: FxRateSet,
    run_id: str,
    entities: list[Entity] | None = None,
    reporting_decimals: int = 4,
) -> TranslationResult:
    """
    Translate each record with the pinned group rate for its statement + scenario.

    - P&L → average for scenario_year (2027 or 2026)
    - BS → closing for year-end (default `{year}-12-31`)
    - Local FX rates in the file are ignored; conflict → VAL-024 INFO
    - Missing group rate → VAL-004 BLOCKER (record omitted from translated)
    - Optional currency ≠ entity functional currency → VAL-021 BLOCKER
    """
    translated: list[TranslatedRecord] = []
    findings: list[FxFinding] = []
    missing: list[str] = []
    entity_map = {e.entity_id: e for e in (entities or [])}

    for rec in records:
        ent = entity_map.get(rec.company_id)
        if ent is not None and rec.currency.upper() != ent.currency:
            findings.append(
                FxFinding(
                    rule_id="VAL-021",
                    severity="BLOCKER",
                    record_id=rec.record_id,
                    reason="row currency ≠ entity functional currency",
                    expected=ent.currency,
                    observed=rec.currency.upper(),
                )
            )
            continue

        closing = None
        if rec.statement.upper() in ("BS", "BALANCE", "BALANCE_SHEET"):
            closing = rec.period if len(rec.period) >= 10 else f"{rec.scenario_year}-12-31"
        rate_period, rate_type = select_rate_period(
            statement=rec.statement,
            scenario_year=rec.scenario_year,
            closing_date=closing,
        )
        rate = rate_set.lookup(
            from_ccy=rec.currency,
            to_ccy=rate_set.reporting_currency,
            period=rate_period,
            rate_type=rate_type,
        )
        if rate is None and rec.currency.upper() == rate_set.reporting_currency:
            # Identity: same currency as reporting — synthesize 1:1 if CSV had no row match.
            from kaikei.domain.fx.models import FxRate

            rate = FxRate(
                rate_id=f"identity-{rec.currency}-{rate_period}",
                rate_set_id=rate_set.rate_set_id,
                from_ccy=rec.currency,
                to_ccy=rate_set.reporting_currency,
                period=rate_period,
                rate_type=rate_type if rate_type else RateType.AVERAGE,
                rate=Decimal("1"),
                source="identity",
            )

        if rate is None:
            findings.append(
                FxFinding(
                    rule_id="VAL-004",
                    severity="BLOCKER",
                    record_id=rec.record_id,
                    reason=(
                        f"missing group FX rate {rec.currency}→"
                        f"{rate_set.reporting_currency} period={rate_period} "
                        f"type={rate_type}"
                    ),
                )
            )
            missing.append(rec.record_id)
            continue

        if rec.local_fx_rate is not None and rec.local_fx_rate != rate.rate:
            findings.append(
                FxFinding(
                    rule_id="VAL-024",
                    severity="INFO",
                    record_id=rec.record_id,
                    reason="local FX assumption conflicts with group rate set; group rate used",
                    expected=str(rate.rate),
                    observed=str(rec.local_fx_rate),
                )
            )

        translated.append(
            translate_amount(
                rec.amount_local,
                rate=rate,
                run_id=run_id,
                canonical_record_id=rec.record_id,
                reporting_decimals=reporting_decimals,
            )
        )

    return TranslationResult(
        translated=translated,
        findings=findings,
        missing_rate_record_ids=missing,
    )
