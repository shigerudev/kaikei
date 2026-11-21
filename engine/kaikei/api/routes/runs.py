"""Consolidation runs (UI contract: lib/api/types.ts Run). Read side only for now."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from kaikei.api.deps import get_session
from kaikei.application.uploads import UploadError, parse_group_id
from kaikei.infrastructure.db import models

router = APIRouter(prefix="/api/v1", tags=["runs"])

_NOT_YET = "run serialization lands with run orchestration (PIPER-72)"


@router.get("/consolidations")
def list_runs(group_id: str, session: Annotated[Session, Depends(get_session)]) -> list[Any]:
    """Runs for a group, newest first. Empty until run orchestration creates one; never invented."""
    try:
        gid = parse_group_id(group_id)
    except UploadError as err:
        raise HTTPException(err.status, err.message) from err
    if session.get(models.Group, gid) is None:
        raise HTTPException(404, f"group {group_id!r} not found")
    has_runs = session.scalar(select(exists().where(models.ConsolidationRun.group_id == gid)))
    if has_runs:
        # TODO(Antonio): serialize Run (stages, counts) with PIPER-72.
        raise HTTPException(501, _NOT_YET)
    return []


@router.get("/consolidations/{run_id}")
def get_run(run_id: str, session: Annotated[Session, Depends(get_session)]) -> Any:
    try:
        rid = parse_group_id(run_id)
    except UploadError:
        raise HTTPException(404, f"run {run_id!r} not found") from None
    if session.get(models.ConsolidationRun, rid) is None:
        raise HTTPException(404, f"run {run_id!r} not found")
    raise HTTPException(501, _NOT_YET)
