"""HTTP e2e: a new group (Kurai Tachi) from API only. Skipped without TEST_DATABASE_URL."""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from kaikei.api.deps import get_session, get_store
from kaikei.application.pipeline import RUN_ORDER, RUNS
from kaikei.infrastructure.db.base import Base
from kaikei.infrastructure.storage import LocalObjectStore
from kaikei.main import create_app
from kaikei.settings import Settings, get_settings

PACK = Path(__file__).resolve().parents[1] / "fixtures" / "kurai-tachi"
EXPECTED = json.loads((PACK / "expected.json").read_text())
TEST_DB = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine(TEST_DB)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    store = LocalObjectStore(tmp_path)
    get_settings.cache_clear()
    app = create_app(
        Settings(storage_backend="local", storage_local_dir=str(tmp_path), auth_required=False)
    )

    def _session() -> Iterator[Session]:
        s = factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_store] = lambda: store
    monkeypatch.setattr("kaikei.application.group_config._try_session", lambda: factory())
    monkeypatch.setattr("kaikei.infrastructure.storage.get_object_store", lambda *_a, **_k: store)
    RUNS.clear()
    RUN_ORDER.clear()
    with TestClient(app) as tc:
        yield tc
    Base.metadata.drop_all(engine)
    engine.dispose()
    get_settings.cache_clear()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_kurai_tachi_new_group_http(client: TestClient):
    signup = client.post(
        "/api/v1/auth/signup",
        json={"email": "owner@kurai.example", "name": "Owner", "password": "password1"},
    )
    assert signup.status_code == 200, signup.text
    token = signup.json()["token"]
    h = _auth(token)

    created = client.post(
        "/api/v1/groups",
        headers=h,
        json={
            "name": "Kurai Tachi SA",
            "reporting_currency": "USD",
            "slug": "kurai-tachi",
            "scenario": "BUDGET_2027",
            "fiscal_year": "2027",
        },
    )
    assert created.status_code == 201, created.text
    group = created.json()["slug"]

    companies = [
        {
            "code": "STUDIOS",
            "name": "Kurai Studios",
            "country": "GT",
            "functional_currency": "GTQ",
            "ownership_pct": "100",
            "aliases": ["Studios"],
        },
        {
            "code": "KURAI",
            "name": "Kur AI",
            "country": "GT",
            "functional_currency": "GTQ",
            "ownership_pct": "100",
            "aliases": ["Kurai"],
        },
        {
            "code": "FARMS",
            "name": "Kurai Farms",
            "country": "GT",
            "functional_currency": "GTQ",
            "ownership_pct": "100",
            "aliases": ["Farms"],
        },
    ]
    for body in companies:
        r = client.post(f"/api/v1/groups/{group}/companies", headers=h, json=body)
        assert r.status_code == 201, r.text

    rates = client.post(
        f"/api/v1/groups/{group}/fx-rate-sets",
        headers=h,
        json={
            "name": "budget-2027",
            "rates": [
                {
                    "from_ccy": "GTQ",
                    "to_ccy": "USD",
                    "period": "2027",
                    "rate_type": "average",
                    "rate": "0.1290322581",
                    "units_per_usd": "7.75",
                    "applies_to": "income statement",
                    "source": "team",
                },
                {
                    "from_ccy": "GTQ",
                    "to_ccy": "USD",
                    "period": "2027-12",
                    "rate_type": "closing",
                    "rate": "0.1282051282",
                    "units_per_usd": "7.80",
                    "applies_to": "balance sheet",
                    "source": "team",
                },
            ],
        },
    )
    assert rates.status_code == 201, rates.text

    params = client.put(
        f"/api/v1/groups/{group}/parameters",
        headers=h,
        json=[
            {
                "parameter": "ic_match_tolerance",
                "scope": "group",
                "value": "1.00",
                "unit": "USD",
                "used_for": "intercompany pair matching after conversion",
                "source": "team",
            }
        ],
    )
    assert params.status_code == 200, params.text

    packs = {
        "STUDIOS": PACK / "01_kurai_studios.csv",
        "KURAI": PACK / "02_kur_ai.csv",
        "FARMS": PACK / "03_kurai_farms.csv",
    }
    for company_id, path in packs.items():
        r = client.post(
            "/api/v1/files",
            data={"group_id": group, "company_id": company_id},
            files={"file": (path.name, path.read_bytes(), "text/csv")},
        )
        assert r.status_code in (200, 201), r.text

    mappings = {
        "STUDIOS": [
            {"local_code": "4101", "local_name": "Ventas locales", "group_account": "REV_SALES"},
            {
                "local_code": "4102",
                "local_name": "Hosting a Kurai",
                "group_account": "REV_IC",
                "partner": "KURAI",
            },
            {
                "local_code": "5102",
                "local_name": "Compras a Farms",
                "group_account": "COGS_IC",
                "partner": "FARMS",
            },
        ],
        "KURAI": [
            {
                "local_code": "R100",
                "local_name": "Hosting from Studios",
                "group_account": "REV_IC",
                "partner": "STUDIOS",
            },
        ],
        "FARMS": [
            {
                "local_code": "Ventas locales",
                "local_name": "Ventas locales",
                "group_account": "REV_SALES",
            },
            {
                "local_code": "Ventas a Studios",
                "local_name": "Ventas a Studios",
                "group_account": "REV_IC",
                "partner": "STUDIOS",
            },
        ],
    }
    for company_id, accounts in mappings.items():
        put = client.put(
            f"/api/v1/groups/{group}/companies/{company_id}/mapping",
            headers=h,
            json={"accounts": accounts},
        )
        assert put.status_code == 200, put.text
        ap = client.post(f"/api/v1/mappings/{group}:{company_id}/approve")
        assert ap.status_code in (200, 201), ap.text

    run = client.post("/api/v1/consolidations", json={"group_id": group, "reason": "e2e"})
    assert run.status_code == 201, run.text
    run_id = run.json()["id"]

    facts = client.get(
        f"/api/v1/consolidations/{run_id}/facts", params={"period": "2027-01", "statement": "PL"}
    )
    assert facts.status_code == 200, facts.text
    by_account = {row["group_account"]: row["amount"] for row in facts.json()["rows"]}
    assert by_account["REV_SALES"] == EXPECTED["facts"]["PL:2027-01:REV_SALES"]
    assert by_account["REV_IC"] == EXPECTED["facts"]["PL:2027-01:REV_IC"]

    findings = client.get(f"/api/v1/consolidations/{run_id}/findings").json()
    assert any(f["rule_id"] == "VAL-003" for f in findings)

    recon = client.get(f"/api/v1/consolidations/{run_id}/reconciliations").json()
    statuses = {m["status"] for m in recon["matches"]}
    assert "MATCHED" in statuses
    assert "MISMATCH" in statuses
