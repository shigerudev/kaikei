"""Balanced elimination journals for matched IC pairs (PLAN.md §8.4)."""

from __future__ import annotations

from decimal import Decimal

from kaikei.domain.consolidation.models import Journal, JournalLine
from kaikei.domain.intercompany.models import MatchGroup, MatchStatus


def assert_balanced(journal: Journal) -> None:
    """Explicit check for callers that build journals outside the Pydantic model."""
    total_debit = sum((line.debit for line in journal.lines), Decimal("0"))
    total_credit = sum((line.credit for line in journal.lines), Decimal("0"))
    if total_debit != total_credit:
        raise ValueError(f"VAL-013 unbalanced journal: debit={total_debit} credit={total_credit}")


def build_elimination_journal(
    match: MatchGroup,
    *,
    journal_id: str,
    revenue_account: str = "IC_REVENUE",
    cos_account: str = "IC_COS",
    amount: Decimal | None = None,
) -> Journal:
    """
    One balanced journal per MATCHED pair: debit IC revenue, credit IC cost of sales.

    Only MATCHED groups may be eliminated. Mismatch / one-sided stay as findings (VAL-007/008).
    """
    if match.status != MatchStatus.MATCHED:
        raise ValueError(f"refuse elimination for status={match.status!r} (VAL-007/008)")

    elim_amount = amount
    if elim_amount is None:
        # Prefer seller side if labelled; else first member.
        seller = next((m for m in match.members if m.side == "seller"), match.members[0])
        elim_amount = abs(seller.amount_group)

    if elim_amount <= 0:
        raise ValueError("elimination amount must be > 0")

    return Journal(
        journal_id=journal_id,
        run_id=match.run_id,
        match_group_id=match.match_group_id,
        lines=[
            JournalLine(group_account_code=revenue_account, debit=elim_amount, credit=Decimal("0")),
            JournalLine(group_account_code=cos_account, debit=Decimal("0"), credit=elim_amount),
        ],
        source_record_ids=[m.record_id for m in match.members],
    )
