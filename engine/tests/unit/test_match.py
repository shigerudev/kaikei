from decimal import Decimal
from pathlib import Path

from kaikei.domain.intercompany import (
    IcCandidate,
    MatchStatus,
    journals_for_matches,
    load_entities,
    load_ic_tolerance,
    match_intercompany,
)

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"


def test_load_tolerance():
    assert load_ic_tolerance(FIXTURES / "parametros_grupo.csv") == Decimal("1.00")


def test_matched_pair_within_tolerance():
    entities = load_entities(FIXTURES / "entidades.csv")
    result = match_intercompany(
        [
            IcCandidate(
                record_id="s1",
                company_id="EMP2",
                period="2027-03",
                amount_group=Decimal("100000.00"),
                partner_text="AG Distribución",
                side="seller",
            ),
            IcCandidate(
                record_id="b1",
                company_id="EMP1",
                period="2027-03",
                amount_group=Decimal("100000.00"),
                partner_text="AGM-GT",
                side="buyer",
            ),
        ],
        entities=entities,
        run_id="run-1",
        tolerance=Decimal("1.00"),
    )
    assert len(result.matches) == 1
    assert result.matches[0].status == MatchStatus.MATCHED
    journals = journals_for_matches(result)
    assert len(journals) == 1
    assert sum(line.debit for line in journals[0].lines) == Decimal("100000.00")


def test_mismatch_e02_style_not_eliminated():
    entities = load_entities(FIXTURES / "entidades.csv")
    result = match_intercompany(
        [
            IcCandidate(
                record_id="s1",
                company_id="EMP2",
                period="2027-03",
                amount_group=Decimal("427500.00"),
                partner_text="EMP1",
                side="seller",
            ),
            IcCandidate(
                record_id="b1",
                company_id="EMP1",
                period="2027-03",
                amount_group=Decimal("472500.00"),  # transposed digits
                partner_text="AG Manufactura",
                side="buyer",
            ),
        ],
        entities=entities,
        run_id="run-1",
    )
    assert result.matches[0].status == MatchStatus.MISMATCH
    assert any(f.rule_id == "VAL-008" for f in result.findings)
    assert journals_for_matches(result) == []


def test_one_sided_e08_style():
    entities = load_entities(FIXTURES / "entidades.csv")
    result = match_intercompany(
        [
            IcCandidate(
                record_id="only",
                company_id="EMP6",
                period="2027-01",
                amount_group=Decimal("15000.00"),
                partner_text="AG España",
                side="seller",
            )
        ],
        entities=entities,
        run_id="run-1",
    )
    assert result.matches[0].status == MatchStatus.ONE_SIDED
    assert any(f.rule_id == "VAL-007" for f in result.findings)
    assert journals_for_matches(result) == []


def test_unknown_partner_not_matched_by_amount():
    entities = load_entities(FIXTURES / "entidades.csv")
    result = match_intercompany(
        [
            IcCandidate(
                record_id="a",
                company_id="EMP1",
                period="2027-01",
                amount_group=Decimal("500"),
                partner_text="Totally External SA",
                side="seller",
            ),
            IcCandidate(
                record_id="b",
                company_id="EMP3",
                period="2027-01",
                amount_group=Decimal("500"),
                partner_text="Also External",
                side="buyer",
            ),
        ],
        entities=entities,
        run_id="run-1",
    )
    assert result.matches == []
    assert "a" in result.unmatched_record_ids
