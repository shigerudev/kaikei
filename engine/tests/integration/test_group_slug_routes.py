"""The UI addresses the configured group by slug on every route (lib/api/index.ts).

The DB-backed upload routes key groups by UUID; a slug must fall back to the in-memory
pipeline instead of answering 404, or the platform layout 404s before rendering.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from kaikei.application.group_config import FIXTURES_ROOT
from kaikei.main import app

client = TestClient(app)
GROUP = "grupo-ag"


def test_group_by_slug():
    r = client.get(f"/api/v1/groups/{GROUP}")
    assert r.status_code == 200
    assert r.json()["id"] == GROUP
    assert r.json()["reporting_currency"] == "USD"


def test_companies_by_slug():
    r = client.get(f"/api/v1/groups/{GROUP}/companies")
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_files_by_slug():
    r = client.get("/api/v1/files", params={"group_id": GROUP})
    assert r.status_code == 200
    assert {f["company_id"] for f in r.json()} >= {"EMP1", "EMP2"}


def test_upload_by_slug():
    path = FIXTURES_ROOT / "grupo-ag" / "01_AG_Distribucion_GT.csv"
    r = client.post(
        "/api/v1/files",
        data={"group_id": GROUP},
        files={"file": (path.name, path.read_bytes(), "text/csv")},
    )
    assert r.status_code in (200, 201)
    body = r.json()
    assert body["file"]["company_id"] == "EMP1"
    assert "alreadyImported" in body


def test_unknown_slug_is_404():
    assert client.get("/api/v1/groups/nope").status_code == 404
    assert client.get("/api/v1/groups/nope/companies").status_code == 404
    assert client.get("/api/v1/files", params={"group_id": "nope"}).status_code == 404
