"""Shared dependencies and lookups for the routers.

DB session and original-file store (upload vertical), plus the in-memory pipeline's
"resolve a group or a run, or answer 404" helpers.
"""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy.orm import Session

from kaikei.application import RunRecord, get_run
from kaikei.application.group_config import GroupMeta, get_group
from kaikei.infrastructure.db.session import get_sessionmaker
from kaikei.infrastructure.storage import ObjectStore, get_object_store
from kaikei.settings import get_settings


def get_session() -> Iterator[Session]:
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()


@lru_cache
def get_store() -> ObjectStore:
    return get_object_store(get_settings())


def group_or_404(group_id: str) -> GroupMeta:
    group = get_group(group_id)
    if group is None:
        raise HTTPException(status_code=404, detail=f"group {group_id!r} not found")
    return group


def run_or_404(run_id: str) -> RunRecord:
    record = get_run(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"run {run_id!r} not found")
    return record
