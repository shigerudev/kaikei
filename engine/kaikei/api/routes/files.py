"""Stored originals and their parsed preview (MANIFESTO §4.4 `/files`, §4.1 ① Ingest)."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from kaikei.api.deps import group_or_404
from kaikei.application import latest_run
from kaikei.application.contracts import FilePreviewOut, SourceFileOut, UploadResultOut
from kaikei.application.group_config import GROUPS
from kaikei.application.sources import UnknownUploadError, list_files, preview, upload

router = APIRouter(prefix="/api/v1", tags=["files"])

_MAX_BYTES = 20 * 1024 * 1024


@router.get("/files", response_model=list[SourceFileOut])
def get_files(group_id: str = Query()) -> list[SourceFileOut]:
    """One pack per company, with its SHA-256, line count and mapping state."""
    group = group_or_404(group_id)
    return list_files(group.id, latest_run(group.id))


@router.get("/files/{file_id}/preview", response_model=FilePreviewOut)
def get_file_preview(file_id: str, group_id: str | None = Query(default=None)) -> FilePreviewOut:
    """The rows the engine read from this pack, each with its source cell, plus its mapping.

    The UI addresses a file by id alone, so with no `group_id` the configured groups are
    searched for the one that holds it — never a hard-coded group.
    """
    group_ids = [group_or_404(group_id).id] if group_id else list(GROUPS)
    for candidate in group_ids:
        result = preview(candidate, file_id, latest_run(candidate))
        if result is not None:
            return result
    raise HTTPException(status_code=404, detail=f"file {file_id!r} not found")


@router.post("/files", response_model=UploadResultOut, status_code=201)
async def post_file(
    group_id: str = Form(),
    file: UploadFile = File(),
) -> UploadResultOut:
    """Store an original unchanged and report whether this exact hash was already imported.

    Originals are append-only (MANIFESTO principle 2): the bytes are hashed as received and
    the file is never rewritten. A file this build can't place is refused with a reason —
    the alternative, accepting it and leaving it unparsed, is the silent drop the manifesto
    forbids.
    """
    group = group_or_404(group_id)
    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="file larger than 20 MB")
    try:
        return upload(group.id, file.filename or "", data)
    except UnknownUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
