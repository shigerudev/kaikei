"""Assemble a `Lineage` trail from already-computed contributions/adjustments.

Pure function: it never recomputes a figure, it only arranges figures the
engine already produced (MANIFESTO principle 1 — "the engine calculates",
lineage just explains it).
"""

from __future__ import annotations

from decimal import Decimal

from kaikei.domain.lineage.models import Lineage, LineageAdjustment, LineageContribution
from kaikei.domain.normalization.models import Statement


def build_lineage(
    *,
    fact_id: str,
    run_id: str,
    group_account_code: str,
    period: str,
    statement: Statement,
    currency: str,
    contributions: list[LineageContribution],
    adjustments: list[LineageAdjustment],
    finding_ids: list[str],
) -> Lineage:
    # An excluded contribution stays visible in the trail but is out of the total: a BLOCKER
    # removed it from this fact's scope, and netting it in anyway would hide the problem.
    contributions_total = sum(
        (c.amount_group for c in contributions if not c.excluded), Decimal("0")
    )
    adjustments_total = sum((a.amount_group for a in adjustments), Decimal("0"))
    return Lineage(
        fact_id=fact_id,
        run_id=run_id,
        group_account_code=group_account_code,
        period=period,
        statement=statement,
        currency=currency,
        amount=contributions_total + adjustments_total,
        contributions_total=contributions_total,
        adjustments_total=adjustments_total,
        contributions=contributions,
        adjustments=adjustments,
        finding_ids=finding_ids,
    )
