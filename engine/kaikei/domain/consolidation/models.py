"""K5 Journal contract: Σ debit = Σ credit (SCOPE §2 K5)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class JournalLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    group_account_code: str
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    company_id: str | None = None

    @model_validator(mode="after")
    def _one_side(self) -> JournalLine:
        if self.debit < 0 or self.credit < 0:
            raise ValueError("debit/credit must be ≥ 0")
        if (self.debit > 0) == (self.credit > 0):
            raise ValueError("exactly one of debit or credit must be > 0")
        return self


class Journal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    journal_id: str
    run_id: str
    match_group_id: str
    rule_id: str = "ELIM-IC"
    rule_version: str = "ic-v1"
    currency: str = "USD"
    lines: list[JournalLine] = Field(min_length=2)
    source_record_ids: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _balanced(self) -> Journal:
        total_debit = sum((line.debit for line in self.lines), Decimal("0"))
        total_credit = sum((line.credit for line in self.lines), Decimal("0"))
        if total_debit != total_credit:
            raise ValueError(f"unbalanced journal: debit={total_debit} credit={total_credit}")
        return self
