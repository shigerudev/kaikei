from decimal import Decimal
from pathlib import Path

import pytest

from kaikei.domain.fx import RateType, load_rate_set, translate_amount
from kaikei.domain.fx.rates import select_rate_period

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"


def test_load_tasas_grupo():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    assert rates.reporting_currency == "USD"
    gtq_avg_2027 = rates.lookup(
        from_ccy="GTQ", to_ccy="USD", period="2027", rate_type=RateType.AVERAGE
    )
    assert gtq_avg_2027 is not None
    assert gtq_avg_2027.rate == Decimal("0.129032")

    gtq_close = rates.lookup(
        from_ccy="GTQ", to_ccy="USD", period="2027-12-31", rate_type=RateType.CLOSING
    )
    assert gtq_close is not None
    assert gtq_close.rate == Decimal("0.128205")


def test_select_rate_period_policy():
    assert select_rate_period(statement="PL", scenario_year="2027") == ("2027", RateType.AVERAGE)
    assert select_rate_period(statement="BS", scenario_year="2027") == (
        "2027-12-31",
        RateType.CLOSING,
    )


def test_translate_amount_uses_decimal():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    rate = rates.lookup(from_ccy="GTQ", to_ccy="USD", period="2027", rate_type=RateType.AVERAGE)
    assert rate is not None
    # units_per_usd=7.75 → ~1 USD for 7.75 GTQ at the pinned average
    out = translate_amount(
        Decimal("7.75"),
        rate=rate,
        run_id="run-1",
        canonical_record_id="rec-1",
    )
    assert out.amount_group == Decimal("1.0000")
    assert out.fx_rate_id == rate.rate_id


def test_missing_rate_returns_none():
    rates = load_rate_set(FIXTURES / "tasas_grupo.csv")
    assert (
        rates.lookup(from_ccy="MXN", to_ccy="USD", period="2027", rate_type=RateType.AVERAGE)
        is None
    )


def test_reject_non_positive_rate():
    from kaikei.domain.fx.models import FxRate

    with pytest.raises(ValueError):
        FxRate(
            rate_id="x",
            rate_set_id="s",
            from_ccy="GTQ",
            to_ccy="USD",
            period="2027",
            rate_type=RateType.AVERAGE,
            rate=Decimal("0"),
            source="t",
        )
