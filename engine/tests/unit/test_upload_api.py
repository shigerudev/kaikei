"""POST /api/v1/files. DB-backed tests need TEST_DATABASE_URL (Postgres); the rest run bare."""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from kaikei.api.deps import get_session, get_store
from kaikei.application.seed import seed_group
from kaikei.application.uploads import MAX_UPLOAD_BYTES
from kaikei.infrastructure.db import models
from kaikei.infrastructure.db.base import Base
from kaikei.infrastructure.storage import LocalObjectStore
from kaikei.main import create_app
from kaikei.settings import Settings

PACK = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"
TEST_DB = os.environ.get("TEST_DATABASE_URL")


def _client(session_factory, store) -> TestClient:
    app = create_app(Settings(storage_backend="local"))

    def _session() -> Iterator[Session | None]:
        s = session_factory() if session_factory else None
        try:
            yield s
        finally:
            if s:
                s.close()

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_store] = lambda: store
    return TestClient(app)


def _post(client, group_id, name, data):
    return client.post("/api/v1/files", data={"group_id": group_id}, files={"file": (name, data)})


GID = "00000000-0000-0000-0000-000000000001"


def test_wrong_extension_400(tmp_path):
    r = _post(_client(None, LocalObjectStore(tmp_path)), GID, "x.pdf", b"abc")
    assert r.status_code == 400


def test_oversize_413(tmp_path):
    r = _post(
        _client(None, LocalObjectStore(tmp_path)), GID, "x.csv", b"a" * (MAX_UPLOAD_BYTES + 1)
    )
    assert r.status_code == 413


def test_nul_bytes_in_csv_422(tmp_path):
    r = _post(_client(None, LocalObjectStore(tmp_path)), GID, "x.csv", b"a,b\x00\n")
    assert r.status_code == 422


@pytest.fixture
def db():
    if not TEST_DB:
        pytest.skip("TEST_DATABASE_URL not set")
    engine = create_engine(TEST_DB)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as s:
        group = seed_group(s, PACK, "Grupo AG")
        s.commit()
        gid = str(group.id)
    yield factory, gid
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_new_then_repeat_upload(db, tmp_path):
    factory, gid = db
    store = LocalObjectStore(tmp_path)
    client = _client(factory, store)
    data = (PACK / "01_AG_Distribucion_GT.csv").read_bytes()

    r1 = _post(client, gid, "01_AG_Distribucion_GT.csv", data)
    assert r1.status_code == 200
    body = r1.json()
    assert body["alreadyImported"] is False
    assert body["file"]["status"] == "UPLOADED"
    assert body["file"]["company_id"] is not None  # resolved from group config

    r2 = _post(client, gid, "renamed.csv", data)
    assert r2.status_code == 200
    assert r2.json()["alreadyImported"] is True
    assert r2.json()["file"]["id"] == body["file"]["id"]

    with factory() as s:
        assert s.scalar(select(func.count()).select_from(models.SourceFile)) == 1
    assert sum(1 for p in tmp_path.rglob("*") if p.is_file()) == 1

    assert client.get(f"/api/v1/files?group_id={gid}").json()[0]["id"] == body["file"]["id"]
    assert client.get(f"/api/v1/files/{body['file']['id']}").status_code == 200
    assert client.get(f"/api/v1/groups/{gid}/companies").json()[0]["aliases"]


def test_unresolved_company_is_null(db, tmp_path):
    factory, gid = db
    r = _post(
        _client(factory, LocalObjectStore(tmp_path)),
        gid,
        "mystery.csv",
        (PACK / "03_AG_ElSalvador.csv").read_bytes(),
    )
    assert r.status_code == 200
    assert r.json()["file"]["company_id"] is None


def test_unknown_group_404(db, tmp_path):
    factory, _ = db
    client = _client(factory, LocalObjectStore(tmp_path))
    assert _post(client, GID, "x.csv", b"a\n").status_code == 404
    assert _post(client, "not-a-uuid", "x.csv", b"a\n").status_code == 404
    assert not any(p.is_file() for p in tmp_path.rglob("*"))


def test_upload_persists_source_rows_with_cells(db, tmp_path):
    """AC1: every parsed line is stored with its cell coordinates (pack 01: 153 data + 1 note)."""
    factory, gid = db
    client = _client(factory, LocalObjectStore(tmp_path))
    r = _post(
        client, gid, "01_AG_Distribucion_GT.csv", (PACK / "01_AG_Distribucion_GT.csv").read_bytes()
    )
    assert r.status_code == 200
    assert r.json()["file"]["rows"] == 154
    with factory() as s:
        rows = s.scalars(select(models.SourceRow).order_by(models.SourceRow.row_number)).all()
        assert len(rows) == 154
        assert rows[0].row_number == 2  # line 1 is the header
        assert all(row.cell_refs for row in rows if row.raw["kind"] == "data")
    # repeat upload: 0 new rows
    _post(
        client, gid, "01_AG_Distribucion_GT.csv", (PACK / "01_AG_Distribucion_GT.csv").read_bytes()
    )
    with factory() as s:
        assert s.scalar(select(func.count()).select_from(models.SourceRow)) == 154


def test_upload_records_located_ingest_findings(db, tmp_path):
    """Pack 05 line 80 (answer key E09) carries a dot-decimal amount in a decimal-comma file."""
    factory, gid = db
    client = _client(factory, LocalObjectStore(tmp_path))
    r = _post(client, gid, "05_AG_Espana.csv", (PACK / "05_AG_Espana.csv").read_bytes())
    assert r.status_code == 200
    assert r.json()["file"]["parse_warnings"]  # WARNING surfaced to the UI
    with factory() as s:
        f = s.scalars(
            select(models.ValidationFinding).where(models.ValidationFinding.severity == "WARNING")
        ).one()
        assert f.source_cell and f.source_cell.endswith("80")
        assert f.context["stage"] == "ingest"


def test_blocker_file_is_rejected_and_not_stored(db, tmp_path):
    factory, gid = db
    client = _client(factory, LocalObjectStore(tmp_path))
    r = _post(client, gid, "01_AG_Distribucion_GT.csv", b"PK\x03\x04 not really a csv")
    assert r.status_code == 422
    assert not any(p.is_file() for p in tmp_path.rglob("*"))
    with factory() as s:
        assert s.scalar(select(func.count()).select_from(models.SourceFile)) == 0


def test_consolidations_empty_until_a_run_exists(db, tmp_path):
    factory, gid = db
    client = _client(factory, LocalObjectStore(tmp_path))
    assert client.get(f"/api/v1/consolidations?group_id={gid}").json() == []
    assert client.get(f"/api/v1/consolidations?group_id={GID}").status_code == 404
