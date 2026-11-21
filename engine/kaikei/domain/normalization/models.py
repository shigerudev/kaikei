"""
K2 CanonicalRecord + K3 mapping configs (SCOPE §2, PLAN §6.2–6.3, MANIFESTO §4.2).

Period convention (Jose / PIPER-58): monthly budget → `YYYY-MM`; annual actuals
(e.g. 2026 Total) → `YYYY`. Parsers never invent twelve months from one annual row.
"""

from __future__ import annotations

import re
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

from kaikei.domain.ingestion.models import SourceRef

PERIOD_RE = re.compile(r"^\d{4}(-\d{2})?$")
DecAmount = Annotated[Decimal, Field(max_digits=20, decimal_places=4)]


class Statement(StrEnum):
    PL = "PL"
    BS = "BS"


class SignRule(StrEnum):
    """How the source file encodes polarity before mapping to normal balance."""

    NORMAL_BALANCE = "normal_balance"
    PARENTHESES_NEGATIVE = "parentheses_negative"
    DEBIT_CREDIT_COLUMNS = "debit_credit_columns"
    SIGNED = "signed"


class StructuralMapping(BaseModel):
    """Per-company structural mapping (PLAN §6.2) — layout, not COA."""

    model_config = ConfigDict(extra="forbid")

    mapping_version: str
    company_id: str
    sheet: str | None = None
    header_row: int = Field(ge=1)
    preamble_lines: int = Field(default=0, ge=0)
    account_code_column: str | None = None
    description_column: str | None = None
    amount_columns: dict[str, str] = Field(default_factory=dict)
    amount_column: str | None = None  # long format: single amount col
    period_column: str | None = None
    scenario_column: str | None = None
    counterparty_column: str | None = None
    debit_column: str | None = None
    credit_column: str | None = None
    numeric_locale: str = "en_US"
    sign_rule: SignRule = SignRule.NORMAL_BALANCE
    defaults: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _has_amount_shape(self) -> StructuralMapping:
        wide = bool(self.amount_columns)
        long_ = self.amount_column is not None
        dc = self.debit_column is not None and self.credit_column is not None
        if sum((wide, long_, dc)) != 1:
            raise ValueError(
                "structural mapping needs exactly one of: amount_columns (wide), "
                "amount_column (long), or debit_column+credit_column"
            )
        return self


class AccountMapping(BaseModel):
    """Local account → group account (PLAN §6.3)."""

    model_config = ConfigDict(extra="forbid")

    mapping_version: str
    company_id: str
    source_account_code: str
    source_account_name: str | None = None
    group_account_code: str
    account_type: str
    normal_balance: Literal["DEBIT", "CREDIT"]
    sign_multiplier: int = Field(default=1)
    fx_policy: str | None = None
    partner_company_id: str | None = None
    ic_eligible: bool = False
    effective_from: str | None = None

    @field_validator("sign_multiplier")
    @classmethod
    def _sign_pm1(cls, v: int) -> int:
        if v not in (-1, 1):
            raise ValueError("sign_multiplier must be 1 or -1")
        return v


class MappingConfig(BaseModel):
    """Bundle used by normalize: one structural + N account rows for a company."""

    model_config = ConfigDict(extra="forbid")

    structural: StructuralMapping
    accounts: list[AccountMapping]

    @model_validator(mode="after")
    def _same_company(self) -> MappingConfig:
        for row in self.accounts:
            if row.company_id != self.structural.company_id:
                raise ValueError(
                    f"account mapping company_id {row.company_id!r} "
                    f"!= structural {self.structural.company_id!r}"
                )
        return self


class CanonicalRecord(BaseModel):
    """One company + group account + period + scenario + currency + amount + source."""

    model_config = ConfigDict(extra="forbid")

    record_id: str
    source_row_id: str | None = None
    source: SourceRef
    company_id: str
    scenario_id: str
    scenario_year: str
    period: str
    statement: Statement
    group_account_code: str
    local_account_code: str | None = None
    local_account_name: str | None = None
    amount_local: Decimal
    currency: str
    partner_company_id: str | None = None
    partner_text: str | None = None
    mapping_version: str
    side: Literal["seller", "buyer", "unknown"] = "unknown"
    ic_eligible: bool = False

    @field_validator("currency")
    @classmethod
    def _iso_ccy(cls, v: str) -> str:
        code = v.strip().upper()
        if len(code) != 3 or not code.isalpha():
            raise ValueError(f"invalid ISO currency: {v!r}")
        return code

    @field_validator("period")
    @classmethod
    def _period_shape(cls, v: str) -> str:
        if not PERIOD_RE.match(v):
            raise ValueError(f"period must be YYYY or YYYY-MM, got {v!r}")
        if len(v) == 7:
            month = int(v[5:7])
            if month < 1 or month > 12:
                raise ValueError(f"invalid month in period {v!r}")
        return v

    @field_validator("scenario_year")
    @classmethod
    def _year(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}", v):
            raise ValueError(f"scenario_year must be YYYY, got {v!r}")
        return v

    @field_serializer("amount_local")
    def _amount_str(self, v: Decimal) -> str:
        return format(v, "f")

    @classmethod
    def model_validate_json_roundtrip(cls, data: dict[str, Any]) -> CanonicalRecord:
        """Parse JSON where amounts arrive as decimal strings."""
        return cls.model_validate(data)
