"""Parsed preview of a stored pack (MANIFESTO §4.4 `/files/{id}/preview`, §4.1 ① Ingest)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from kaikei.api.deps import get_session, group_or_404
from kaikei.application import latest_run
from kaikei.application.contracts import (
    AccountMappingOut,
    FilePreviewOut,
    PreviewRowOut,
    SourceRefOut,
)
from kaikei.application.group_config import list_group_ids
from kaikei.application.sources import account_mapping, preview
from kaikei.infrastructure.db import models

router = APIRouter(prefix="/api/v1", tags=["files"])

_PREVIEW_ROWS = 20


def _preview_from_db(session: Session, file_row: models.SourceFile) -> FilePreviewOut:
    rows = list(
        session.scalars(
            select(models.SourceRow)
            .where(models.SourceRow.source_file_id == file_row.id)
            .order_by(models.SourceRow.row_number)
            .limit(_PREVIEW_ROWS)
        )
    )
    company = session.get(models.Company, file_row.company_id) if file_row.company_id else None
    group = session.get(models.Group, file_row.group_id)
    mapping: list[AccountMappingOut] = []
    if group is not None and company is not None:
        mapping = account_mapping(group.slug, company.code)
    preview_rows: list[PreviewRowOut] = []
    for row in rows:
        raw = row.raw or {}
        cells = raw.get("cells") or {}
        roles = raw.get("roles") or {}
        account_h = roles.get("account") or roles.get("label")
        local = str(cells.get(account_h, "") if account_h else "")
        amount_h = roles.get("amount") or roles.get("debit") or roles.get("credit")
        amount_raw = str(cells.get(amount_h, "") if amount_h else "")
        period = str(raw.get("period") or "")
        cell_refs = row.cell_refs or {}
        cell = next(iter(cell_refs.values()), None) if isinstance(cell_refs, dict) else None
        preview_rows.append(
            PreviewRowOut(
                source=SourceRefOut(
                    filename=file_row.filename,
                    sheet=row.sheet or None,
                    row=row.row_number,
                    column=amount_h or account_h,
                    cell=cell,
                    raw=amount_raw or local,
                ),
                local_account=local,
                local_name=local,
                period=period,
                amount_local=amount_raw or "0",
                currency=company.functional_currency if company else "",
                group_account=None,
                partner_company_id=None,
                statement="PL",
            )
        )
    return FilePreviewOut(file_id=str(file_row.id), rows=preview_rows, account_mapping=mapping)


@router.get("/files/{file_id}/preview", response_model=FilePreviewOut)
def get_file_preview(
    file_id: str,
    session: Annotated[Session, Depends(get_session)],
    group_id: str | None = Query(default=None),
) -> FilePreviewOut:
    """The rows the engine read from this pack, each with its source cell, plus its mapping."""
    group_ids = [group_or_404(group_id).id] if group_id else list_group_ids()
    for candidate in group_ids:
        result = preview(candidate, file_id, latest_run(candidate))
        if result is not None:
            return result
    try:
        fid = UUID(file_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail=f"file {file_id!r} not found") from None
    row = session.get(models.SourceFile, fid)
    if row is None:
        raise HTTPException(status_code=404, detail=f"file {file_id!r} not found")
    return _preview_from_db(session, row)
