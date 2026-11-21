"""Consolidated fact + run status (SCOPE §2 K8, MANIFESTO §4.2) — happy-path slice.

The K8 `Run` itself is the published contract and lives in `contracts.py` with the rest of
the API surface (SCOPE §2 K8 defines a run by exactly those fields, so there is one model,
not an internal copy and a wire copy).

`ConsolidatedFact` is the stored layer — one row of MANIFESTO §4.2's `consolidated_facts`,
one group account and period per run. The statement the reviewer reads (subtotals, totals,
the per-company split) is assembled from these by `presentation.statement`.
"""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, field_serializer

from kaikei.domain.normalization.models import Statement


class RunStatus(StrEnum):
    """Subset of MANIFESTO §4.1 statuses this synchronous build actually reaches."""

    DRAFT = "DRAFT"
    BLOCKED = "BLOCKED"
    PUBLISHED = "PUBLISHED"


class ConsolidatedFact(BaseModel):
    """One published-or-draft report cell: Σ contributions + Σ adjustments (MANIFESTO §4.2)."""

    model_config = ConfigDict(extra="forbid")

    fact_id: str
    run_id: str
    group_account_code: str
    period: str
    statement: Statement
    currency: str
    contributions_total: Decimal
    adjustments_total: Decimal
    amount: Decimal

    @field_serializer("contributions_total", "adjustments_total", "amount")
    def _amount_as_string(self, v: Decimal) -> str:
        return format(v, "f")
