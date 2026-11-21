"""Group configuration from the snapshot store (no fixtures/ at request time)."""

from fastapi.testclient import TestClient

from kaikei.application.iso4217 import is_iso_4217
from kaikei.main import app

client = TestClient(app)


def test_iso_4217_accepts_gtq_usd_eur():
    assert is_iso_4217("gtq")
    assert is_iso_4217("USD")
    assert is_iso_4217("EUR")
    assert not is_iso_4217("US")
    assert not is_iso_4217("QQQ")


def test_list_and_get_sample_group():
    listed = client.get("/api/v1/groups").json()
    assert any(g["id"] == "grupo-ag" for g in listed)
    group = client.get("/api/v1/groups/grupo-ag").json()
    assert group["id"] == "grupo-ag"
    assert group["slug"] == "grupo-ag"
    assert group["reporting_currency"] == "USD"
    assert group["scenario"] == "BUDGET_2027"


def test_accounts_are_the_group_chart():
    accounts = client.get("/api/v1/groups/grupo-ag/accounts").json()
    codes = {a["code"] for a in accounts}
    assert "REV_SALES" in codes
    assert "COGS_IC" in codes
    assert all(a["statement"] in ("PL", "BS") for a in accounts)


def test_missing_rate_is_not_an_api_error_on_get():
    """A missing rate for a company currency is a run-time BLOCKER, not 4xx here."""
    rates = client.get("/api/v1/groups/grupo-ag/fx-rate-sets/current")
    assert rates.status_code == 200
    assert rates.json()["rates"]
