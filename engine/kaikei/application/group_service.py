"""Create/update group configuration in Postgres (D1). Missing FX rates are not API errors."""

from __future__ import annotations

import re
import uuid
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kaikei.application.contracts import (
    CreateCompanyRequest,
    CreateGroupRequest,
    CreateRateSetRequest,
    ParameterOut,
)
from kaikei.application.group_config import put_state, slugify
from kaikei.application.group_repo import load_state
from kaikei.application.iso4217 import is_iso_4217
from kaikei.application.seed import seed_chart
from kaikei.application.uploads import normalize_alias
from kaikei.infrastructure.db import models

_PERIOD = re.compile(r"^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$")
_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_CODE = re.compile(r"^[A-Za-z0-9._-]+$")


class ConfigError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def _refresh(session: Session, group: models.Group) -> None:
    state = load_state(session, str(group.id))
    if state is not None:
        put_state(state)


def _currency(code: str) -> str:
    value = code.strip().upper()
    if not is_iso_4217(value):
        raise ConfigError(422, f"invalid ISO 4217 currency {code!r}")
    return value


def _ownership(raw: str) -> Decimal:
    try:
        value = Decimal(raw)
    except (InvalidOperation, TypeError) as exc:
        raise ConfigError(422, "ownership_pct must be a decimal string") from exc
    if value < 0 or value > 100:
        raise ConfigError(422, "ownership_pct must be between 0 and 100")
    return value


def _unique_slug(session: Session, wanted: str) -> str:
    base = slugify(wanted)
    if not _SLUG.match(base):
        raise ConfigError(422, f"invalid slug {wanted!r}")
    slug = base
    n = 2
    while session.scalar(select(models.Group.id).where(models.Group.slug == slug)):
        slug = f"{base}-{n}"
        n += 1
    return slug


def get_group_row(session: Session, group_id: str) -> models.Group:
    row = None
    try:
        row = session.get(models.Group, uuid.UUID(group_id))
    except (ValueError, AttributeError, TypeError):
        row = None
    if row is None:
        row = session.scalar(select(models.Group).where(models.Group.slug == group_id))
    if row is None:
        raise ConfigError(404, f"group {group_id!r} not found")
    return row


def create_group(session: Session, body: CreateGroupRequest) -> models.Group:
    reporting = _currency(body.reporting_currency)
    slug = _unique_slug(session, body.slug or body.name)
    if session.scalar(select(models.Group.id).where(models.Group.name == body.name.strip())):
        # names need not be globally unique; slug is. Allow duplicate names.
        pass
    group = models.Group(name=body.name.strip(), reporting_currency=reporting, slug=slug)
    session.add(group)
    session.flush()
    seed_chart(session, group)
    fiscal_year = body.fiscal_year or "2027"
    try:
        year = int(fiscal_year)
    except ValueError as exc:
        raise ConfigError(422, "fiscal_year must be a four-digit year") from exc
    scenario = (body.scenario or f"BUDGET_{year}").strip()
    session.add(models.Scenario(group_id=group.id, code=scenario, fiscal_year=year))
    session.flush()
    _refresh(session, group)
    return group


def list_groups(session: Session) -> list[models.Group]:
    rows = session.scalars(select(models.Group).order_by(models.Group.name)).all()
    if rows:
        return list(rows)
    return []


def add_company(session: Session, group_id: str, body: CreateCompanyRequest) -> models.Company:
    group = get_group_row(session, group_id)
    name = body.name.strip()
    if session.scalar(
        select(models.Company.id).where(
            models.Company.group_id == group.id, models.Company.name == name
        )
    ):
        raise ConfigError(409, f"company name {name!r} already exists in this group")
    code = (body.code or slugify(name).replace("-", "").upper()[:64] or "CO").strip()
    if not _CODE.match(code):
        raise ConfigError(422, f"invalid company code {code!r}")
    if session.scalar(
        select(models.Company.id).where(
            models.Company.group_id == group.id, models.Company.code == code
        )
    ):
        code = f"{code}-{str(uuid.uuid4())[:8]}"
    country = body.country.strip().upper()
    if len(country) != 2 or not country.isalpha():
        raise ConfigError(422, "country must be an ISO 3166-1 alpha-2 code")
    company = models.Company(
        group_id=group.id,
        code=code,
        name=name,
        country=country,
        functional_currency=_currency(body.functional_currency),
        ownership_pct=_ownership(body.ownership_pct),
    )
    session.add(company)
    session.flush()
    seen = {
        a
        for a in session.scalars(
            select(models.CompanyAlias.alias_normalized).where(
                models.CompanyAlias.group_id == group.id
            )
        )
    }
    incoming: list[tuple[str, str]] = []
    seen_incoming: set[str] = set()
    for alias in [name, code, *body.aliases]:
        norm = normalize_alias(alias)
        if not norm or norm in seen_incoming:
            continue
        seen_incoming.add(norm)
        incoming.append((alias.strip(), norm))
    for alias, norm in incoming:
        if norm in seen:
            raise ConfigError(409, f"alias {alias!r} is already used in this group")
        session.add(
            models.CompanyAlias(
                group_id=group.id,
                company_id=company.id,
                alias=alias,
                alias_normalized=norm,
            )
        )
        seen.add(norm)
    session.flush()
    _refresh(session, group)
    return company


def replace_parameters(
    session: Session, group_id: str, rows: list[ParameterOut]
) -> list[models.GroupParameter]:
    group = get_group_row(session, group_id)
    existing = session.scalars(
        select(models.GroupParameter).where(models.GroupParameter.group_id == group.id)
    ).all()
    for row in existing:
        session.delete(row)
    session.flush()
    out: list[models.GroupParameter] = []
    seen: set[tuple[str, str]] = set()
    for item in rows:
        key = (item.parameter, item.scope)
        if key in seen:
            raise ConfigError(422, f"duplicate parameter {item.parameter!r} scope {item.scope!r}")
        seen.add(key)
        row = models.GroupParameter(
            group_id=group.id,
            parameter=item.parameter,
            scope=item.scope or "group",
            value=item.value,
            unit=item.unit,
            used_for=item.used_for,
            source=item.source,
        )
        session.add(row)
        out.append(row)
    session.flush()
    _refresh(session, group)
    return out


def add_rate_set(session: Session, group_id: str, body: CreateRateSetRequest) -> models.FxRateSet:
    group = get_group_row(session, group_id)
    current = session.scalar(
        select(func.max(models.FxRateSet.version)).where(models.FxRateSet.group_id == group.id)
    )
    version = int(current or 0) + 1
    rate_set = models.FxRateSet(
        group_id=group.id,
        name=(body.name or f"v{version}").strip(),
        version=version,
        reporting_currency=group.reporting_currency,
    )
    session.add(rate_set)
    session.flush()
    seen: set[tuple[str, str, str, str]] = set()
    for item in body.rates:
        from_ccy = _currency(item.from_ccy)
        to_ccy = _currency(item.to_ccy)
        if not _PERIOD.match(item.period):
            raise ConfigError(422, f"invalid rate period {item.period!r}")
        key = (from_ccy, to_ccy, item.period, item.rate_type)
        if key in seen:
            raise ConfigError(422, "duplicate rate row")
        seen.add(key)
        try:
            rate = Decimal(item.rate)
        except (InvalidOperation, TypeError) as exc:
            raise ConfigError(422, "rate must be a decimal string") from exc
        if rate <= 0:
            raise ConfigError(422, "rate must be > 0")
        units = None
        if item.units_per_usd:
            try:
                units = Decimal(item.units_per_usd)
            except (InvalidOperation, TypeError) as exc:
                raise ConfigError(422, "units_per_usd must be a decimal string") from exc
        session.add(
            models.FxRate(
                rate_set_id=rate_set.id,
                from_ccy=from_ccy,
                to_ccy=to_ccy,
                period=item.period,
                rate_type=item.rate_type,
                rate=rate,
                units_per_usd=units,
                applies_to=item.applies_to,
                source=item.source,
            )
        )
    session.flush()
    _refresh(session, group)
    return rate_set


def current_rate_set(session: Session, group_id: str) -> models.FxRateSet | None:
    group = get_group_row(session, group_id)
    return session.scalar(
        select(models.FxRateSet)
        .where(models.FxRateSet.group_id == group.id)
        .order_by(models.FxRateSet.version.desc())
    )


def list_rate_sets(session: Session, group_id: str) -> list[models.FxRateSet]:
    group = get_group_row(session, group_id)
    return list(
        session.scalars(
            select(models.FxRateSet)
            .where(models.FxRateSet.group_id == group.id)
            .order_by(models.FxRateSet.version.desc())
        )
    )
