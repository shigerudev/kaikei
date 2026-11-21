"""Load a GroupState snapshot from K1 tables (D1)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from kaikei.application.group_config import (
    CompanyConfig,
    GroupMeta,
    GroupState,
    MappingEntry,
    ParameterRow,
)
from kaikei.domain.fx.models import FxRate, FxRateSet, RateType
from kaikei.domain.intercompany.aliases import Entity
from kaikei.infrastructure.db import models


def _group_row(session: Session, group_id: str) -> models.Group | None:
    if _is_uuid(group_id):
        row = session.get(models.Group, uuid.UUID(group_id))
        if row is not None:
            return row
    return session.scalar(select(models.Group).where(models.Group.slug == group_id))


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def load_state(session: Session, group_id: str) -> GroupState | None:
    group = _group_row(session, group_id)
    if group is None:
        return None
    return _state_for(session, group)


def load_all_states(session: Session) -> list[GroupState]:
    groups = session.scalars(select(models.Group).order_by(models.Group.name)).all()
    return [_state_for(session, g) for g in groups]


def _state_for(session: Session, group: models.Group) -> GroupState:
    scenario = session.scalar(
        select(models.Scenario)
        .where(models.Scenario.group_id == group.id)
        .order_by(models.Scenario.code)
    )
    fiscal_year = str(scenario.fiscal_year) if scenario else ""
    scenario_code = scenario.code if scenario else ""
    companies = _companies(session, group.id)
    rate_set_row = session.scalar(
        select(models.FxRateSet)
        .where(models.FxRateSet.group_id == group.id)
        .order_by(models.FxRateSet.version.desc())
    )
    rate_set, units = _rates(session, group, rate_set_row)
    params = tuple(
        ParameterRow(
            parameter=p.parameter,
            scope=p.scope,
            value=p.value,
            unit=p.unit,
            used_for=p.used_for,
            source=p.source,
        )
        for p in session.scalars(
            select(models.GroupParameter)
            .where(models.GroupParameter.group_id == group.id)
            .order_by(models.GroupParameter.parameter, models.GroupParameter.scope)
        )
    )
    accounts = tuple(
        (
            a.code,
            a.name,
            a.statement,
            a.account_type,
            a.normal_balance,
            a.ic_eligible,
        )
        for a in session.scalars(
            select(models.GroupAccount)
            .where(models.GroupAccount.group_id == group.id)
            .order_by(models.GroupAccount.code)
        )
    )
    mapping_version = session.scalar(
        select(models.MappingVersion)
        .where(models.MappingVersion.group_id == group.id)
        .order_by(models.MappingVersion.created_at.desc())
    )
    mappings = _mappings(session, group.id, companies)
    meta = GroupMeta(
        id=group.slug,
        name=group.name,
        reporting_currency=group.reporting_currency,
        scenario=scenario_code,
        fiscal_year=fiscal_year,
        closing_period=f"{fiscal_year}-12" if fiscal_year else "",
        uuid=str(group.id),
        mapping_version=mapping_version.version if mapping_version else "v1",
        rate_set_version=str(rate_set_row.version) if rate_set_row else "1",
    )
    return GroupState(
        meta=meta,
        companies=companies,
        rate_set=rate_set,
        units=units,
        parameters=params,
        mappings=mappings,
        accounts=accounts,
    )


def _companies(session: Session, group_id: uuid.UUID) -> tuple[CompanyConfig, ...]:
    rows = session.scalars(
        select(models.Company)
        .where(models.Company.group_id == group_id)
        .order_by(models.Company.code)
    ).all()
    aliases_by_company: dict[uuid.UUID, list[str]] = {}
    for alias in session.scalars(
        select(models.CompanyAlias).where(models.CompanyAlias.group_id == group_id)
    ):
        aliases_by_company.setdefault(alias.company_id, []).append(alias.alias)
    out: list[CompanyConfig] = []
    for c in rows:
        entity = Entity(
            entity_id=c.code,
            name=c.name,
            country=c.country or "",
            currency=c.functional_currency,
            file=c.pack_filename or "",
            ownership_pct=c.ownership_pct,
            aliases=tuple(sorted(aliases_by_company.get(c.id, []))),
        )
        out.append(CompanyConfig(entity=entity, file_format=c.layout_note or "", uuid=str(c.id)))
    return tuple(out)


def _rates(
    session: Session, group: models.Group, rate_set_row: models.FxRateSet | None
) -> tuple[FxRateSet, dict[tuple[str, str, str], str]]:
    if rate_set_row is None:
        return (
            FxRateSet(rate_set_id="", reporting_currency=group.reporting_currency, rates=[]),
            {},
        )
    units: dict[tuple[str, str, str], str] = {}
    rates: list[FxRate] = []
    for row in session.scalars(
        select(models.FxRate)
        .where(models.FxRate.rate_set_id == rate_set_row.id)
        .order_by(models.FxRate.from_ccy, models.FxRate.rate_type, models.FxRate.period)
    ):
        key = (row.from_ccy, row.rate_type, row.period)
        units[key] = format(row.units_per_usd, "f") if row.units_per_usd is not None else ""
        rates.append(
            FxRate(
                rate_id=str(row.id),
                rate_set_id=str(rate_set_row.id),
                from_ccy=row.from_ccy,
                to_ccy=row.to_ccy,
                period=row.period,
                rate_type=RateType(row.rate_type),
                rate=row.rate,
                source=row.source,
                applies_to=row.applies_to or "",
            )
        )
    return (
        FxRateSet(
            rate_set_id=str(rate_set_row.id),
            reporting_currency=rate_set_row.reporting_currency,
            rates=rates,
        ),
        units,
    )


def _mappings(
    session: Session,
    group_id: uuid.UUID,
    companies: tuple[CompanyConfig, ...],
) -> dict[str, tuple[MappingEntry, ...]]:
    versions = session.scalars(
        select(models.MappingVersion)
        .where(models.MappingVersion.group_id == group_id)
        .order_by(models.MappingVersion.created_at.desc())
    ).all()
    if not versions:
        return {}
    latest_by_company: dict[uuid.UUID, models.MappingVersion] = {}
    for version in versions:
        latest_by_company.setdefault(version.company_id, version)
    code_by_uuid = {uuid.UUID(c.uuid): c.entity.entity_id for c in companies if c.uuid}
    account_code = {
        a.id: a.code
        for a in session.scalars(
            select(models.GroupAccount).where(models.GroupAccount.group_id == group_id)
        )
    }
    buckets: dict[str, list[MappingEntry]] = {}
    for version in latest_by_company.values():
        for row in session.scalars(
            select(models.AccountMapping).where(
                models.AccountMapping.mapping_version_id == version.id
            )
        ):
            company_code = code_by_uuid.get(row.company_id)
            if not company_code:
                continue
            partner = None
            if row.partner_company_id is not None:
                partner = code_by_uuid.get(row.partner_company_id)
            buckets.setdefault(company_code, []).append(
                MappingEntry(
                    local_code=row.local_code,
                    local_name=row.local_name or "",
                    group_account=account_code.get(row.group_account_id, ""),
                    account_type="",
                    counterparty=partner,
                )
            )
    return {k: tuple(v) for k, v in buckets.items()}
