"""Group configuration (MANIFESTO §2, §4.4). Configuration is data in Postgres (D1)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from kaikei.api.deps import get_session, group_or_404, require_group_member
from kaikei.application import latest_run, list_runs
from kaikei.application.auth import (
    AuthError,
    add_member_by_email,
    add_owner,
    issue_mcp_token,
    membership,
    resolve_mcp_token,
    user_from_token,
)
from kaikei.application.contracts import (
    CompanyOut,
    CreateCompanyRequest,
    CreateGroupRequest,
    CreateRateSetRequest,
    GroupAccountOut,
    GroupOut,
    ParameterOut,
    RateSetOut,
    SearchHitOut,
)
from kaikei.application.group_config import get_state, list_states, put_state
from kaikei.application.group_repo import load_state
from kaikei.application.group_service import (
    ConfigError,
    add_company,
    add_rate_set,
    create_group,
    get_group_row,
    replace_parameters,
)
from kaikei.application.presentation import (
    companies_out,
    group_out,
    parameters_out,
    rate_set_out,
    runs_out,
    search_out,
)
from kaikei.application.sources import list_files
from kaikei.infrastructure.db import models

router = APIRouter(prefix="/api/v1", tags=["groups"])


def _http(err: ConfigError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.message)


def _group_out_row(session: Session, group: models.Group) -> GroupOut:
    code = session.scalar(
        select(models.Scenario.code)
        .where(models.Scenario.group_id == group.id)
        .order_by(models.Scenario.code)
    )
    return GroupOut(
        id=group.slug,
        slug=group.slug,
        name=group.name,
        reporting_currency=group.reporting_currency,
        scenario=code or "",
    )


def _hydrate(session: Session, group_id: str) -> str:
    """Load this session's group into the snapshot store; fall back to memory (tests)."""
    try:
        group = get_group_row(session, group_id)
        state = load_state(session, str(group.id))
    except (ConfigError, SQLAlchemyError):
        return group_or_404(group_id).id
    if state is not None:
        put_state(state)
        return state.meta.id
    return group.slug


@router.post("/groups", response_model=GroupOut, status_code=201)
def post_group(
    body: CreateGroupRequest,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> GroupOut:
    try:
        group = create_group(session, body)
        token = (authorization or "").removeprefix("Bearer ").strip()
        user = user_from_token(session, token) if token else None
        if user is not None:
            add_owner(session, user.id, group.id)
        session.commit()
        return _group_out_row(session, group)
    except ConfigError as err:
        session.rollback()
        raise _http(err) from err


@router.get("/groups", response_model=list[GroupOut])
def get_groups(
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> list[GroupOut]:
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = user_from_token(session, token) if token else None
    try:
        rows = session.scalars(select(models.Group).order_by(models.Group.name)).all()
    except SQLAlchemyError:
        rows = []
    if user is not None and rows:
        rows = [g for g in rows if membership(session, user.id, g.id) is not None]
    if rows:
        return [_group_out_row(session, g) for g in rows]
    if user is not None:
        return []
    return [group_out(s.meta) for s in list_states()]


@router.get("/groups/{group_id}", response_model=GroupOut)
def get_group(
    group_id: str,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> GroupOut:
    require_group_member(session, group_id, authorization)
    slug = _hydrate(session, group_id)
    return group_out(group_or_404(slug))


@router.post("/groups/{group_id}/companies", response_model=CompanyOut, status_code=201)
def post_company(
    group_id: str,
    body: CreateCompanyRequest,
    session: Annotated[Session, Depends(get_session)],
) -> CompanyOut:
    try:
        company = add_company(session, group_id, body)
        session.commit()
    except ConfigError as err:
        session.rollback()
        raise _http(err) from err
    aliases = list(body.aliases)
    return CompanyOut(
        id=company.code,
        name=company.name,
        country=company.country or "",
        functional_currency=company.functional_currency,
        ownership_pct=format(company.ownership_pct, "f"),
        aliases=aliases,
        filename=company.pack_filename or "",
        format=company.layout_note or "",
    )


@router.get("/groups/{group_id}/companies", response_model=list[CompanyOut])
def get_companies(
    group_id: str, session: Annotated[Session, Depends(get_session)]
) -> list[CompanyOut]:
    return companies_out(_hydrate(session, group_id))


@router.post("/groups/{group_id}/fx-rate-sets", response_model=RateSetOut, status_code=201)
def post_rate_set(
    group_id: str,
    body: CreateRateSetRequest,
    session: Annotated[Session, Depends(get_session)],
) -> RateSetOut:
    try:
        add_rate_set(session, group_id, body)
        session.commit()
    except ConfigError as err:
        session.rollback()
        raise _http(err) from err
    return rate_set_out(_hydrate(session, group_id))


@router.get("/groups/{group_id}/fx-rate-sets", response_model=list[RateSetOut])
def get_rate_sets(
    group_id: str, session: Annotated[Session, Depends(get_session)]
) -> list[RateSetOut]:
    slug = _hydrate(session, group_id)
    return [rate_set_out(slug)]


@router.get("/groups/{group_id}/fx-rate-sets/current", response_model=RateSetOut)
def get_current_rate_set(
    group_id: str, session: Annotated[Session, Depends(get_session)]
) -> RateSetOut:
    return rate_set_out(_hydrate(session, group_id))


@router.put("/groups/{group_id}/parameters", response_model=list[ParameterOut])
def put_parameters(
    group_id: str,
    body: list[ParameterOut],
    session: Annotated[Session, Depends(get_session)],
) -> list[ParameterOut]:
    try:
        replace_parameters(session, group_id, body)
        session.commit()
    except ConfigError as err:
        session.rollback()
        raise _http(err) from err
    return parameters_out(_hydrate(session, group_id))


@router.get("/groups/{group_id}/parameters", response_model=list[ParameterOut])
def get_parameters(
    group_id: str, session: Annotated[Session, Depends(get_session)]
) -> list[ParameterOut]:
    return parameters_out(_hydrate(session, group_id))


@router.get("/groups/{group_id}/accounts", response_model=list[GroupAccountOut])
def get_accounts(
    group_id: str, session: Annotated[Session, Depends(get_session)]
) -> list[GroupAccountOut]:
    slug = _hydrate(session, group_id)
    state = get_state(slug)
    rows = state.accounts if state is not None else ()
    return [
        GroupAccountOut(
            code=code,
            name=name,
            statement=statement,  # type: ignore[arg-type]
            account_type=account_type,
            normal_balance=normal_balance,
            ic_eligible=ic_eligible,
        )
        for code, name, statement, account_type, normal_balance, ic_eligible in rows
    ]


class MemberIn(BaseModel):
    email: str


class McpTokenIn(BaseModel):
    label: str = ""


@router.post("/groups/{group_id}/members", status_code=201)
def post_member(
    group_id: str,
    body: MemberIn,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    require_group_member(session, group_id, authorization)
    group = get_group_row(session, group_id)
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = user_from_token(session, token) if token else None
    if user is not None:
        mine = membership(session, user.id, group.id)
        if mine is None or mine.role != "owner":
            raise HTTPException(403, "only an owner can add members")
    try:
        row = add_member_by_email(session, group.id, body.email)
        session.commit()
    except AuthError as err:
        raise HTTPException(err.status, err.message) from err
    return {"user_id": str(row.user_id), "role": row.role}


@router.post("/groups/{group_id}/mcp-tokens", status_code=201)
def post_mcp_token(
    group_id: str,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
    body: McpTokenIn | None = None,
) -> dict[str, str]:
    require_group_member(session, group_id, authorization)
    group = get_group_row(session, group_id)
    token = issue_mcp_token(session, group.id, body.label if body else "")
    session.commit()
    return {"token": token, "group": group.slug}


@router.get("/mcp/resolve/{token}")
def mcp_resolve(token: str, session: Annotated[Session, Depends(get_session)]) -> dict[str, str]:
    group = resolve_mcp_token(session, token)
    if group is None:
        raise HTTPException(404, "unknown group token")
    return {"group": group.slug}


@router.get("/groups/{group_id}/search", response_model=list[SearchHitOut])
def search(group_id: str, q: str = Query(min_length=0)) -> list[SearchHitOut]:
    group = group_or_404(group_id)
    record = latest_run(group.id)
    return search_out(
        group.id,
        q,
        record,
        files=list_files(group.id, record),
        runs=runs_out(list_runs(group.id)),
    )
