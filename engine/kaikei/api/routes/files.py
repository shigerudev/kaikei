"""Source files and groups (UI contract: lib/api/types.ts SourceFile / Group / Company)."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from kaikei.api.deps import get_session, get_store
from kaikei.application import latest_run
from kaikei.application import sources as pipeline_sources
from kaikei.application.group_config import GroupMeta, is_uuid
from kaikei.application.group_config import get_group as get_configured_group
from kaikei.application.uploads import (
    MAX_UPLOAD_BYTES,
    UploadError,
    parse_group_id,
    resolve_group_uuid,
    upload_file,
    validate_upload,
)
from kaikei.infrastructure.db import models
from kaikei.infrastructure.storage import ObjectStore

router = APIRouter(prefix="/api/v1", tags=["files"])


def _configured_group(group_id: str) -> GroupMeta | None:
    """Memory registry (tests/seed) vs Postgres. UUID ids always use the DB upload path."""
    if is_uuid(group_id):
        return None
    return get_configured_group(group_id)


def _json(payload: object, status_code: int = 200) -> JSONResponse:
    return JSONResponse(jsonable_encoder(payload), status_code=status_code)


FileStatus = Literal["MISSING", "UPLOADED", "MAPPING_APPROVED", "REJECTED"]


class SourceFileOut(BaseModel):
    id: str
    company_id: str | None  # NULL until the filename resolves to a configured company
    filename: str
    sha256: str | None
    uploaded_at: str | None
    status: FileStatus
    format: str
    rows: int | None
    records: int | None
    parse_warnings: list[str]
    mapping_version: str | None


class UploadOut(BaseModel):
    file: SourceFileOut
    alreadyImported: bool  # noqa: N815  (UI contract)


def _file_out(f: models.SourceFile, session: Session) -> SourceFileOut:
    rows = session.scalar(
        select(func.count())
        .select_from(models.SourceRow)
        .where(models.SourceRow.source_file_id == f.id)
    )
    warnings = session.scalars(
        select(models.ValidationFinding.reason)
        .where(
            models.ValidationFinding.context["source_file_id"].astext == str(f.id),
            models.ValidationFinding.severity != "INFO",
        )
        .order_by(models.ValidationFinding.created_at)
    )
    return SourceFileOut(
        id=str(f.id),
        company_id=str(f.company_id) if f.company_id else None,
        filename=f.filename,
        sha256=f.sha256,
        uploaded_at=f.uploaded_at.isoformat() if f.uploaded_at else None,
        status="UPLOADED",  # TODO(Jose): MAPPING_APPROVED once mappings exist (K3)
        format=f.filename.rsplit(".", 1)[-1].lower(),
        rows=rows or None,
        records=None,
        parse_warnings=list(warnings),
        mapping_version=None,
    )


def _http(err: UploadError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.message)


@router.post("/files", response_model=UploadOut)
def post_file(
    session: Annotated[Session, Depends(get_session)],
    store: Annotated[ObjectStore, Depends(get_store)],
    group_id: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    company_id: Annotated[str | None, Form()] = None,
) -> UploadOut:
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    try:
        name = validate_upload(file.filename or "", data)
    except UploadError as err:
        raise _http(err) from err
    configured = _configured_group(group_id)
    if configured is not None:
        try:
            result_out = pipeline_sources.upload(configured.id, name, data, company_id=company_id)
        except pipeline_sources.UnknownUploadError as exc:
            raise HTTPException(422, str(exc)) from exc
        return _json(result_out, status_code=201)
    try:
        result = upload_file(session, store, group_id, name, data, company_id=company_id)
    except NotImplementedError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except UploadError as err:
        raise _http(err) from err
    return UploadOut(file=_file_out(result.file, session), alreadyImported=result.already_imported)


@router.get("/files", response_model=list[SourceFileOut])
def list_files(
    session: Annotated[Session, Depends(get_session)], group_id: str
) -> list[SourceFileOut]:
    configured = _configured_group(group_id)
    if configured is not None:
        return _json(pipeline_sources.list_files(configured.id, latest_run(configured.id)))
    try:
        gid = resolve_group_uuid(session, group_id)
    except UploadError as err:
        raise _http(err) from err
    except SQLAlchemyError as err:
        raise HTTPException(status_code=404, detail=f"group {group_id!r} not found") from err
    companies = list(
        session.scalars(
            select(models.Company)
            .where(models.Company.group_id == gid)
            .order_by(models.Company.code)
        )
    )
    stored = list(
        session.scalars(
            select(models.SourceFile)
            .where(models.SourceFile.group_id == gid)
            .order_by(models.SourceFile.uploaded_at)
        )
    )
    latest: dict = {}
    unresolved: list[models.SourceFile] = []
    for row in stored:
        if row.company_id is None:
            unresolved.append(row)
        else:
            latest[row.company_id] = row
    out: list[SourceFileOut] = []
    for company in companies:
        row = latest.get(company.id)
        if row is None:
            fmt = (company.pack_filename or "").rsplit(".", 1)[-1].lower()
            out.append(
                SourceFileOut(
                    id=str(company.id),
                    company_id=str(company.id),
                    filename=company.pack_filename or "",
                    sha256=None,
                    uploaded_at=None,
                    status="MISSING",
                    format=fmt,
                    rows=None,
                    records=None,
                    parse_warnings=[],
                    mapping_version=None,
                )
            )
        else:
            out.append(_file_out(row, session))
    out.extend(_file_out(row, session) for row in unresolved)
    return out


@router.get("/files/{file_id}", response_model=SourceFileOut)
def get_file(file_id: str, session: Annotated[Session, Depends(get_session)]) -> SourceFileOut:
    try:
        fid = parse_group_id(file_id)
    except UploadError:
        raise HTTPException(404, f"file {file_id!r} not found") from None
    row = session.get(models.SourceFile, fid)
    if row is None:
        raise HTTPException(404, f"file {file_id!r} not found")
    return _file_out(row, session)
