"""Mapping draft, suggestion and approval (MANIFESTO §4.4 mapping approval)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from kaikei.api.deps import get_session, group_or_404
from kaikei.application.contracts import SourceFileOut
from kaikei.application.group_service import ConfigError
from kaikei.application.mapping_service import approve, get_mapping, put_mapping
from kaikei.application.sources import approve_mapping

router = APIRouter(prefix="/api/v1", tags=["mappings"])


class MappingRowIn(BaseModel):
    local_code: str
    local_name: str | None = None
    group_account: str | None = None
    partner: str | None = None


class MappingPutIn(BaseModel):
    accounts: list[MappingRowIn]


@router.get("/groups/{group_id}/companies/{company_id}/mapping")
def get_company_mapping(
    group_id: str,
    company_id: str,
    session: Annotated[Session, Depends(get_session)],
) -> dict:
    group_or_404(group_id)
    return get_mapping(session, group_id, company_id)


@router.put("/groups/{group_id}/companies/{company_id}/mapping")
def put_company_mapping(
    group_id: str,
    company_id: str,
    body: MappingPutIn,
    session: Annotated[Session, Depends(get_session)],
) -> dict:
    group_or_404(group_id)
    try:
        out = put_mapping(
            session,
            group_id,
            company_id,
            [row.model_dump() for row in body.accounts],
        )
        try:
            session.commit()
        except SQLAlchemyError:
            session.rollback()
    except ConfigError as err:
        raise HTTPException(err.status, err.message) from err
    return out


@router.post("/mappings/{mapping_id}/approve", response_model=SourceFileOut)
def approve_route(
    mapping_id: str, session: Annotated[Session, Depends(get_session)]
) -> SourceFileOut:
    group_id, _, company_id = mapping_id.partition(":")
    if not company_id:
        raise HTTPException(status_code=422, detail="mapping id must be '{group_id}:{company_id}'")
    group = group_or_404(group_id)
    try:
        approve(session, group.id, company_id)
        try:
            session.commit()
        except SQLAlchemyError:
            session.rollback()
    except ConfigError as err:
        raise HTTPException(err.status, err.message) from err
    try:
        return approve_mapping(group.id, company_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"no stored pack for company {company_id!r}; upload it first",
        ) from exc
