"""Migration + append-only trigger tests. Skipped unless TEST_DATABASE_URL is set."""

import os
import uuid
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from alembic import command

URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="TEST_DATABASE_URL not set")

ENGINE_DIR = Path(__file__).resolve().parents[2]


@pytest.fixture
def migrated(monkeypatch):
    from kaikei import settings

    monkeypatch.setenv("DATABASE_URL", URL)
    settings.get_settings.cache_clear()
    cfg = Config(str(ENGINE_DIR / "alembic.ini"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    eng = create_engine(URL)
    yield eng
    eng.dispose()
    command.downgrade(cfg, "base")
    settings.get_settings.cache_clear()


def _seed(conn) -> tuple[uuid.UUID, uuid.UUID]:
    gid = conn.execute(
        text(
            "INSERT INTO groups (name, slug, reporting_currency) "
            "VALUES ('g', 'g', 'USD') RETURNING id"
        )
    ).scalar_one()
    fid = conn.execute(
        text(
            "INSERT INTO source_files (group_id, filename, sha256, stored_uri) "
            "VALUES (:g, 'a.csv', :h, 'file:///a.csv') RETURNING id"
        ),
        {"g": gid, "h": "a" * 64},
    ).scalar_one()
    return gid, fid


def test_source_files_update_and_delete_rejected(migrated):
    with migrated.begin() as conn:
        _seed(conn)
    with pytest.raises(DBAPIError, match="append-only"), migrated.begin() as conn:
        conn.execute(text("UPDATE source_files SET filename = 'b.csv'"))
    with pytest.raises(DBAPIError, match="append-only"), migrated.begin() as conn:
        conn.execute(text("DELETE FROM source_files"))
    with pytest.raises(DBAPIError, match="append-only"), migrated.begin() as conn:
        conn.execute(text("TRUNCATE source_files CASCADE"))


def test_source_rows_update_and_delete_rejected(migrated):
    with migrated.begin() as conn:
        _, fid = _seed(conn)
        conn.execute(
            text(
                "INSERT INTO source_rows (source_file_id, sheet, row_number, raw, cell_refs) "
                "VALUES (:f, 's', 1, '{}'::jsonb, '{}'::jsonb)"
            ),
            {"f": fid},
        )
    with pytest.raises(DBAPIError, match="append-only"), migrated.begin() as conn:
        conn.execute(text("UPDATE source_rows SET sheet = 'x'"))
    with pytest.raises(DBAPIError, match="append-only"), migrated.begin() as conn:
        conn.execute(text("DELETE FROM source_rows"))


def test_duplicate_group_sha256_rejected(migrated):
    with migrated.begin() as conn:
        gid, _ = _seed(conn)
    with pytest.raises(IntegrityError), migrated.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO source_files (group_id, filename, sha256, stored_uri) "
                "VALUES (:g, 'dup.csv', :h, 'file:///dup.csv')"
            ),
            {"g": gid, "h": "a" * 64},
        )
