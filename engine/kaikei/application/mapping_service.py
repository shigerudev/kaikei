"""Per-company mapping drafts and approvals (Phase 3)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from kaikei.application import group_config
from kaikei.application.canonical import _local_code
from kaikei.application.chart_of_accounts import ACCOUNTS
from kaikei.application.contracts import AccountMappingOut, SourceRefOut
from kaikei.application.group_config import MappingEntry, get_state
from kaikei.application.group_service import ConfigError, get_group_row
from kaikei.application.sources import approve_mapping, registry
from kaikei.domain.ingestion import IngestHint, ingest_file
from kaikei.infrastructure.db import models

_DRAFTS: dict[tuple[str, str], list[dict[str, str | None]]] = {}


def _company(session: Session, group: models.Group, company_id: str) -> models.Company:
    try:
        cid = uuid.UUID(company_id)
        row = session.get(models.Company, cid)
    except (ValueError, AttributeError, TypeError):
        row = session.scalar(
            select(models.Company).where(
                models.Company.group_id == group.id, models.Company.code == company_id
            )
        )
    if row is None or row.group_id != group.id:
        raise ConfigError(404, f"company {company_id!r} not found")
    return row


def _suggest_partner(group_id: str, local_name: str) -> str | None:
    needle = local_name.casefold()
    for company in group_config.load_companies(group_id):
        aliases = (company.entity.name, company.entity.entity_id, *company.entity.aliases)
        if any(a and a.casefold() in needle for a in aliases):
            return company.entity.entity_id
    return None


def _distinct_locals(group_id: str, company_code: str) -> list[dict[str, object]]:
    stored = registry(group_id).files.get(company_code)
    if stored is None or not stored.data:
        return []
    company = next(
        (c for c in group_config.load_companies(group_id) if c.entity.entity_id == company_code),
        None,
    )
    hint = IngestHint(currency=company.entity.currency if company else None)
    ingested = ingest_file(stored.filename, stored.data, hint=hint)
    seen: dict[str, dict[str, object]] = {}
    for row in ingested.rows:
        if row.kind != "data":
            continue
        code = _local_code(row)
        if not code:
            continue
        bucket = seen.setdefault(
            code,
            {
                "local_code": code,
                "local_name": code,
                "samples": [],
                "source_refs": [],
            },
        )
        samples: list[str] = bucket["samples"]  # type: ignore[assignment]
        refs: list[SourceRefOut] = bucket["source_refs"]  # type: ignore[assignment]
        for header, cell in row.cells.items():
            if header in (row.roles.get("label"), row.roles.get("account")):
                if cell.raw:
                    bucket["local_name"] = cell.raw
                continue
            if cell.value is None:
                continue
            if len(samples) < 3:
                samples.append(
                    str(cell.value)
                    if not isinstance(cell.value, Decimal)
                    else format(cell.value, "f")
                )
            if len(refs) < 3:
                refs.append(
                    SourceRefOut(
                        filename=stored.filename,
                        row=row.row,
                        column=header,
                        cell=cell.ref.cell,
                        raw=cell.raw,
                    )
                )
    return list(seen.values())


def current_entries(group_id: str, company_id: str) -> dict[str, MappingEntry]:
    draft = _DRAFTS.get((group_id, company_id))
    if draft:
        return {
            str(row["local_code"]): MappingEntry(
                local_code=str(row["local_code"]),
                local_name=str(row.get("local_name") or row["local_code"]),
                group_account=str(row.get("group_account") or ""),
                account_type="",
                counterparty=row.get("partner"),
            )
            for row in draft
            if row.get("local_code")
        }
    return {e.local_code: e for e in group_config.mapping_entries(group_id, company_id)}


def get_mapping(session: Session | None, group_id: str, company_id: str) -> dict[str, object]:
    code = company_id
    if session is not None:
        try:
            group = get_group_row(session, group_id)
            code = _company(session, group, company_id).code
            group_id = group.slug
        except (ConfigError, SQLAlchemyError):
            pass
    entries = current_entries(group_id, code)
    accounts = []
    for raw in _distinct_locals(group_id, code):
        local = str(raw["local_code"])
        mapped = entries.get(local)
        group_account = mapped.group_account if mapped and mapped.group_account else None
        chart = ACCOUNTS.get(group_account) if group_account else None
        ic = bool(chart and chart.ic_eligible)
        partner = mapped.counterparty if mapped else None
        if ic and not partner:
            partner = _suggest_partner(group_id, str(raw.get("local_name") or local))
        accounts.append(
            {
                "local_code": local,
                "local_name": raw.get("local_name") or local,
                "group_account": group_account,
                "partner": partner,
                "samples": raw.get("samples") or [],
                "source_refs": raw.get("source_refs") or [],
            }
        )
    return {"company_id": code, "accounts": accounts}


def put_mapping(
    session: Session | None, group_id: str, company_id: str, rows: list[dict[str, str | None]]
) -> dict[str, object]:
    code = company_id
    if session is not None:
        try:
            group = get_group_row(session, group_id)
            code = _company(session, group, company_id).code
            group_id = group.slug
        except (ConfigError, SQLAlchemyError):
            pass
    _DRAFTS[(group_id, code)] = rows
    entries = []
    for row in rows:
        local = (row.get("local_code") or "").strip()
        group_account = (row.get("group_account") or "").strip()
        if not local:
            continue
        entries.append(
            MappingEntry(
                local_code=local,
                local_name=(row.get("local_name") or local).strip(),
                group_account=group_account,
                account_type="",
                counterparty=row.get("partner") or None,
            )
        )
    state = get_state(group_id)
    if state is not None:
        mappings = dict(state.mappings)
        mappings[code] = tuple(entries)
        state.mappings = mappings
    return get_mapping(session, group_id, code)


def approve(
    session: Session | None, group_id: str, company_id: str, actor: str = "reviewer"
) -> list[AccountMappingOut]:
    slug = group_id
    code = company_id
    group = None
    company = None
    if session is not None:
        try:
            group = get_group_row(session, group_id)
            company = _company(session, group, company_id)
            code = company.code
            slug = group.slug
        except (ConfigError, SQLAlchemyError):
            group = None
            company = None
    if session is not None and group is not None and company is not None:
        entries = list(current_entries(slug, code).values())
        chart = {
            a.code: a
            for a in session.scalars(
                select(models.GroupAccount).where(models.GroupAccount.group_id == group.id)
            )
        }
        companies = {
            c.code: c
            for c in session.scalars(
                select(models.Company).where(models.Company.group_id == group.id)
            )
        }
        n = (
            session.scalar(
                select(models.MappingVersion.version)
                .where(
                    models.MappingVersion.group_id == group.id,
                    models.MappingVersion.company_id == company.id,
                )
                .order_by(models.MappingVersion.created_at.desc())
            )
            or "0"
        )
        try:
            next_ver = f"v{int(str(n).lstrip('v') or 0) + 1}"
        except ValueError:
            next_ver = f"v{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
        mv = models.MappingVersion(
            group_id=group.id,
            company_id=company.id,
            version=next_ver,
            structural={},
            approved_by=actor,
            approved_at=datetime.now(UTC),
        )
        session.add(mv)
        session.flush()
        for entry in entries:
            account = chart.get(entry.group_account)
            if account is None:
                continue
            partner = companies.get(entry.counterparty) if entry.counterparty else None
            session.add(
                models.AccountMapping(
                    mapping_version_id=mv.id,
                    company_id=company.id,
                    local_code=entry.local_code,
                    local_name=entry.local_name or None,
                    group_account_id=account.id,
                    sign_multiplier=1,
                    partner_company_id=partner.id if partner is not None else None,
                )
            )
        session.flush()
        stored = registry(slug).files.get(code)
        if stored is not None:
            stored.mapping_version = next_ver
    try:
        approve_mapping(slug, code)
    except KeyError:
        pass
    return [
        AccountMappingOut(
            local_code=e.local_code,
            local_name=e.local_name,
            group_account=e.group_account,
            type=e.account_type,
            partner=e.counterparty,
        )
        for e in current_entries(slug, code).values()
    ]
