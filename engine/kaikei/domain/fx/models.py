"""K5 FX contracts (SCOPE §2 K5). Amounts/rates are Decimal; JSON uses decimal strings."""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RateType(StrEnum):
    AVERAGE = "average"
    CLOSING = "closing"


DecimalStr = Annotated[Decimal, Field(max_digits=28, decimal_places=10)]


class FxRate(BaseModel):
    """Units of `to_ccy` per 1 unit of `from_ccy` (never the reciprocal by accident)."""

    model_config = ConfigDict(extra="forbid")

    rate_id: str
    rate_set_id: str
    from_ccy: str
    to_ccy: str
    period: str
    rate_type: RateType
    rate: Decimal
    source: str
    applies_to: str = ""

    @field_validator("from_ccy", "to_ccy")
    @classmethod
    def _upper_ccy(cls, v: str) -> str:
        code = v.strip().upper()
        if len(code) != 3 or not code.isalpha():
            raise ValueError(f"invalid ISO currency: {v!r}")
        return code

    @field_validator("rate")
    @classmethod
    def _positive_rate(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("FX rate must be > 0")
        return v


class FxRateSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rate_set_id: str
    reporting_currency: str = "USD"
    rates: list[FxRate]

    def lookup(
        self,
        *,
        from_ccy: str,
        to_ccy: str,
        period: str,
        rate_type: RateType,
    ) -> FxRate | None:
        fc = from_ccy.upper()
        tc = to_ccy.upper()
        for rate in self.rates:
            if (
                rate.from_ccy == fc
                and rate.to_ccy == tc
                and rate.period == period
                and rate.rate_type == rate_type
            ):
                return rate
        return None


class TranslatedRecord(BaseModel):
    """Canonical amount translated into the group reporting currency for one run."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    canonical_record_id: str
    fx_rate_id: str
    amount_local: Decimal
    amount_group: Decimal
    currency_local: str
    currency_group: str = "USD"
