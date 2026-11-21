"""Turn MATCHED groups into balanced elimination journals (VAL-013)."""

from __future__ import annotations

from kaikei.domain.consolidation.journals import build_elimination_journal
from kaikei.domain.consolidation.models import Journal
from kaikei.domain.intercompany.match import MatchResult, elimination_amount
from kaikei.domain.intercompany.models import MatchStatus


def journals_for_matches(result: MatchResult) -> list[Journal]:
    """One journal per MATCHED group; mismatch/one-sided are skipped (findings only)."""
    out: list[Journal] = []
    for match in result.matches:
        if match.status != MatchStatus.MATCHED:
            continue
        amount = elimination_amount(match)
        out.append(
            build_elimination_journal(
                match,
                journal_id=f"ELIM-{match.match_group_id}",
                amount=amount,
            )
        )
    return out
