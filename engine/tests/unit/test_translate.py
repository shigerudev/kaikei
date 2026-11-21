from decimal import Decimal
from pathlib import Path

from kaikei.domain.fx import CanonicalAmount, load_rate_set, translate_records
from kaikei.domain.intercompany import load_entities

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"


def test_pl_uses_2027_average():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    entities = load_entities(FIXTURES / "entidades.csv")
    result = translate_records(
        [
            CanonicalAmount(
                record_id="r1",
                company_id="EMP1",
                currency="GTQ",
                amount_local=Decimal("7.75"),
                statement="PL",
                scenario_year="2027",
                period="2027-01",
            )
        ],
        rate_set=rates,
        run_id="run-1",
        entities=entities,
    )
    assert len(result.translated) == 1
    assert result.translated[0].amount_group == Decimal("1.0000")
    assert result.findings == []


def test_bs_uses_closing_rate():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    result = translate_records(
        [
            CanonicalAmount(
                record_id="r2",
                company_id="EMP1",
                currency="GTQ",
                amount_local=Decimal("7.80"),
                statement="BS",
                scenario_year="2027",
                period="2027-12",
            )
        ],
        rate_set=rates,
        run_id="run-1",
    )
    assert result.translated[0].amount_group == Decimal("1.0000")


def test_local_rate_conflict_val_024_still_uses_group_rate():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    result = translate_records(
        [
            CanonicalAmount(
                record_id="e11",
                company_id="EMP1",
                currency="GTQ",
                amount_local=Decimal("7.75"),
                statement="PL",
                scenario_year="2027",
                period="2027-03",
                local_fx_rate=Decimal("0.150000"),  # planted local assumption
            )
        ],
        rate_set=rates,
        run_id="run-1",
    )
    assert result.translated[0].amount_group == Decimal("1.0000")
    assert any(f.rule_id == "VAL-024" for f in result.findings)


def test_missing_rate_val_004():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    result = translate_records(
        [
            CanonicalAmount(
                record_id="mx",
                company_id="EMPX",
                currency="MXN",
                amount_local=Decimal("100"),
                statement="PL",
                scenario_year="2027",
                period="2027-01",
            )
        ],
        rate_set=rates,
        run_id="run-1",
    )
    assert result.translated == []
    assert result.missing_rate_record_ids == ["mx"]
    assert result.findings[0].rule_id == "VAL-004"


def test_currency_mismatch_val_021():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    entities = load_entities(FIXTURES / "entidades.csv")
    result = translate_records(
        [
            CanonicalAmount(
                record_id="bad",
                company_id="EMP1",  # functional GTQ
                currency="USD",
                amount_local=Decimal("10"),
                statement="PL",
                scenario_year="2027",
                period="2027-01",
            )
        ],
        rate_set=rates,
        run_id="run-1",
        entities=entities,
    )
    assert result.translated == []
    assert result.findings[0].rule_id == "VAL-021"
