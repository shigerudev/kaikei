"""Parsed preview of a stored pack (MANIFESTO §4.4 `/files/{id}/preview`, §4.1 ① Ingest)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from kaikei.api.deps import group_or_404
from kaikei.application import latest_run
from kaikei.application.contracts import FilePreviewOut
from kaikei.application.group_config import list_group_ids
from kaikei.application.sources import preview

router = APIRouter(prefix="/api/v1", tags=["files"])


@router.get("/files/{file_id}/preview", response_model=FilePreviewOut)
def get_file_preview(file_id: str, group_id: str | None = Query(default=None)) -> FilePreviewOut:
    """The rows the engine read from this pack, each with its source cell, plus its mapping.

    The UI addresses a file by id alone, so with no `group_id` the configured groups are
    searched for the one that holds it — never a hard-coded group.
    """
    group_ids = [group_or_404(group_id).id] if group_id else list_group_ids()
    for candidate in group_ids:
        result = preview(candidate, file_id, latest_run(candidate))
        if result is not None:
            return result
    raise HTTPException(status_code=404, detail=f"file {file_id!r} not found")
