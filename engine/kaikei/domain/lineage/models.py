"""K-lineage contract: fact -> contributions, rate, matches/journals, findings, source cell.

Mirrors MANIFESTO §4.5 / PLAN.md §13.2 and the shape the UI already expects
(`lib/api/types.ts` `Lineage`), trimmed to the happy-path fields this build needs.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.normalization.models import Statement


class LineageContribution(BaseModel):
    """One company's translated contribution to a fact, down to its source cell."""

    model_config = ConfigDict(extra="forbid")

    record_id: str
    company_id: str
    currency_local: str
    amount_local: Decimal
    fx_rate_id: str | None
    fx_rate: Decimal | None
    amount_group: Decimal
    source: SourceRef
    local_account_code: str = ""
    description: str = ""
    # True when a BLOCKER removed this company from the fact's scope (e.g. VAL-023 keeps an
    # entity's balance sheet out of the consolidated balance). The trail still shows the
    # contribution — the figure is left out of the total, never silently dropped.
    excluded: bool = False

    @field_serializer("amount_local", "amount_group")
    def _amount_as_string(self, v: Decimal) -> str:
        return format(v, "f")

    @field_serializer("fx_rate")
    def _rate_as_string(self, v: Decimal | None) -> str | None:
        return None if v is None else format(v, "f")


class LineageAdjustment(BaseModel):
    """One elimination journal that touched this fact."""

    model_config = ConfigDict(extra="forbid")

    journal_id: str
    match_group_id: str
    rule_id: str
    rule_version: str
    amount_group: Decimal
    source_record_ids: list[str]

    @field_serializer("amount_group")
    def _amount_as_string(self, v: Decimal) -> str:
        return format(v, "f")


class Lineage(BaseModel):
    """The full trace for one consolidated fact (MANIFESTO §3.2 screen 6)."""

    model_config = ConfigDict(extra="forbid")

    fact_id: str
    run_id: str
    group_account_code: str
    period: str
    statement: Statement
    currency: str
    amount: Decimal
    contributions_total: Decimal
    adjustments_total: Decimal
    contributions: list[LineageContribution]
    adjustments: list[LineageAdjustment]
    finding_ids: list[str]

    @field_serializer("amount", "contributions_total", "adjustments_total")
    def _amount_as_string(self, v: Decimal) -> str:
        return format(v, "f")
