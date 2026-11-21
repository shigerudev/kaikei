from decimal import Decimal
from pathlib import Path

import pytest

from kaikei.domain.consolidation import build_elimination_journal
from kaikei.domain.intercompany import (
    MatchGroup,
    MatchMember,
    MatchMode,
    MatchStatus,
    load_entities,
    resolve_alias,
)
from kaikei.domain.intercompany.aliases import normalize_alias

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"


def test_load_and_resolve_aliases():
    entities = load_entities(FIXTURES / "entidades.csv")
    assert len(entities) == 6
    assert resolve_alias("AG Distribución", entities).entity_id == "EMP1"
    assert resolve_alias("ag distribucion gt", entities).entity_id == "EMP1"
    assert resolve_alias("AG-HOLD", entities).entity_id == "EMP6"
    assert resolve_alias("Unknown Co", entities) is None


def test_normalize_strips_accents():
    assert normalize_alias("  AG  Panamá ") == normalize_alias("AG Panama")


def test_matched_journal_is_balanced():
    match = MatchGroup(
        match_group_id="mg-1",
        run_id="run-1",
        mode=MatchMode.AGGREGATE,
        status=MatchStatus.MATCHED,
        members=[
            MatchMember(
                record_id="r1",
                company_id="EMP1",
                side="seller",
                amount_group=Decimal("100000.0000"),
            ),
            MatchMember(
                record_id="r2",
                company_id="EMP2",
                side="buyer",
                amount_group=Decimal("100000.0000"),
            ),
        ],
        difference=Decimal("0"),
        tolerance=Decimal("1.00"),
    )
    journal = build_elimination_journal(match, journal_id="ELIM-001")
    assert sum(line.debit for line in journal.lines) == sum(line.credit for line in journal.lines)


def test_refuse_elimination_on_mismatch():
    match = MatchGroup(
        match_group_id="mg-2",
        run_id="run-1",
        mode=MatchMode.AGGREGATE,
        status=MatchStatus.MISMATCH,
        members=[
            MatchMember(
                record_id="r1",
                company_id="EMP1",
                side="seller",
                amount_group=Decimal("100000"),
            ),
            MatchMember(
                record_id="r2",
                company_id="EMP2",
                side="buyer",
                amount_group=Decimal("98000"),
            ),
        ],
        difference=Decimal("2000"),
        tolerance=Decimal("1.00"),
    )
    with pytest.raises(ValueError, match="VAL-007/008"):
        build_elimination_journal(match, journal_id="ELIM-002")
