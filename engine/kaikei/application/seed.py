"""Idempotent seed of a sample group from a fixture pack.

Usage: python -m kaikei.application.seed grupo-ag fixtures/grupo-ag

Loads the group, companies, aliases, rates, parameters, default chart, and
`answer_key_mapping.csv` as an approved mapping version. Does not run at request time.
"""

from __future__ import annotations

import csv
import sys
from dataclasses import replace
from decimal import Decimal
from pathlib import Path, PurePosixPath

from sqlalchemy import select
from sqlalchemy.orm import Session

from kaikei.application.chart_of_accounts import GROUP_ACCOUNTS, NormalBalance
from kaikei.application.group_config import (
    CompanyConfig,
    GroupMeta,
    GroupState,
    MappingEntry,
    ParameterRow,
    put_state,
    slugify,
)
from kaikei.application.uploads import normalize_alias
from kaikei.domain.fx.models import FxRateSet as DomainFxRateSet
from kaikei.domain.fx.rates import load_rate_set
from kaikei.domain.intercompany.aliases import Entity
from kaikei.infrastructure.db import models as db_models
from kaikei.infrastructure.db.models import (
    AccountMapping,
    Company,
    CompanyAlias,
    Group,
    GroupAccount,
    GroupParameter,
    MappingVersion,
    Scenario,
)
from kaikei.infrastructure.db.session import session_scope


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def seed_chart(session: Session, group: Group) -> dict[str, GroupAccount]:
    existing = {
        a.code: a
        for a in session.scalars(select(GroupAccount).where(GroupAccount.group_id == group.id))
    }
    for account in GROUP_ACCOUNTS:
        if account.code in existing:
            continue
        row = GroupAccount(
            group_id=group.id,
            code=account.code,
            name=account.name,
            statement=account.statement.value,
            account_type=account.account_type,
            normal_balance=("DEBIT" if account.normal_balance is NormalBalance.DEBIT else "CREDIT"),
            ic_eligible=account.ic_eligible,
        )
        session.add(row)
        session.flush()
        existing[account.code] = row
    return existing


def snapshot_from_pack(pack: Path, slug: str, name: str | None = None) -> GroupState:
    """Build an in-process snapshot from a pack directory (tests). Never called per request."""
    pack = pack.resolve()
    params_rows = _rows(pack / "parametros_grupo.csv")
    reporting = next(
        (p["value"] for p in params_rows if p.get("parameter") == "reporting_currency"),
        "USD",
    )
    parameters = tuple(
        ParameterRow(
            parameter=(r.get("parameter") or "").strip(),
            scope=(r.get("scope") or "").strip(),
            value=(r.get("value") or "").strip(),
            unit=(r.get("unit") or "").strip(),
            used_for=(r.get("used_for") or "").strip(),
            source=(r.get("source") or "").strip(),
        )
        for r in params_rows
        if (r.get("parameter") or "").strip()
    )
    entity_rows = _rows(pack / "entidades.csv")
    companies: list[CompanyConfig] = []
    for ent in entity_rows:
        aliases = tuple(a.strip() for a in (ent.get("aliases") or "").split("|") if a.strip())
        entity = Entity(
            entity_id=(ent.get("entity") or "").strip(),
            name=(ent.get("name") or "").strip(),
            country=(ent.get("country") or "").strip().upper(),
            currency=(ent.get("currency") or "").strip().upper(),
            file=(ent.get("file") or "").strip(),
            ownership_pct=Decimal((ent.get("ownership_pct") or "100").strip()),
            aliases=aliases,
        )
        companies.append(
            CompanyConfig(entity=entity, file_format=(ent.get("format") or "").strip())
        )

    rate_set_id = f"{slug}-pinned"
    rates_path = pack / "tasas_grupo.csv"
    loaded = load_rate_set(rates_path, rate_set_id=rate_set_id, reporting_currency=reporting)
    rates = [r for r in loaded.rates if r.from_ccy != reporting]
    units: dict[tuple[str, str, str], str] = {}
    for row in _rows(rates_path):
        currency = (row.get("currency") or "").strip().upper()
        if not currency or currency == reporting:
            continue
        units[
            (
                currency,
                (row.get("rate_type") or "").strip().lower(),
                (row.get("period") or "").strip(),
            )
        ] = (row.get("units_per_usd") or "").strip()

    mappings: dict[str, list[MappingEntry]] = {}
    mapping_path = pack / "answer_key_mapping.csv"
    if mapping_path.is_file():
        for row in _rows(mapping_path):
            company_id = (row.get("entity") or "").strip()
            if not company_id:
                continue
            mappings.setdefault(company_id, []).append(
                MappingEntry(
                    local_code=(row.get("local_account") or "").strip(),
                    local_name=(row.get("local_name") or "").strip(),
                    group_account=(row.get("group_account") or "").strip(),
                    account_type=(row.get("type") or "").strip(),
                    counterparty=(row.get("counterparty") or "").strip() or None,
                )
            )

    display = name or ("Grupo AG" if pack.name == "grupo-ag" else pack.name)
    meta = GroupMeta(
        id=slug or slugify(display),
        name=display,
        reporting_currency=reporting,
        scenario="BUDGET_2027",
        fiscal_year="2027",
        closing_period="2027-12",
        mapping_version="answer_key_mapping.csv",
        rate_set_version="1",
    )
    accounts = tuple(
        (
            a.code,
            a.name,
            a.statement.value,
            a.account_type,
            "DEBIT" if a.normal_balance is NormalBalance.DEBIT else "CREDIT",
            a.ic_eligible,
        )
        for a in GROUP_ACCOUNTS
    )
    return GroupState(
        meta=meta,
        companies=tuple(companies),
        rate_set=DomainFxRateSet(
            rate_set_id=rate_set_id, reporting_currency=reporting, rates=rates
        ),
        units=units,
        parameters=parameters,
        mappings={k: tuple(v) for k, v in mappings.items()},
        accounts=accounts,
        pack_root=pack,
    )


def seed_memory(pack: Path, slug: str, name: str | None = None) -> GroupState:
    state = snapshot_from_pack(pack, slug, name)
    put_state(state)
    from kaikei.application.sources import register_sample_packs

    register_sample_packs(state.meta.id, pack)
    return state


def seed_group(session: Session, pack: Path, group_name: str, slug: str | None = None) -> Group:
    """Write the pack into Postgres. Idempotent on slug / company name."""
    pack = pack.resolve()
    state = snapshot_from_pack(pack, slug or slugify(group_name), group_name)
    slug = state.meta.id
    group = session.scalar(select(Group).where(Group.slug == slug))
    if group is None:
        group = Group(
            name=state.meta.name,
            reporting_currency=state.meta.reporting_currency,
            slug=slug,
        )
        session.add(group)
        session.flush()
    else:
        group.name = state.meta.name
        group.reporting_currency = state.meta.reporting_currency

    chart = seed_chart(session, group)
    scenario = session.scalar(
        select(Scenario).where(Scenario.group_id == group.id, Scenario.code == state.meta.scenario)
    )
    if scenario is None:
        session.add(
            Scenario(
                group_id=group.id,
                code=state.meta.scenario,
                fiscal_year=int(state.meta.fiscal_year),
            )
        )
        session.flush()

    company_by_code: dict[str, Company] = {}
    for cfg in state.companies:
        company = session.scalar(
            select(Company).where(
                Company.group_id == group.id, Company.code == cfg.entity.entity_id
            )
        )
        if company is None:
            company = Company(
                group_id=group.id,
                code=cfg.entity.entity_id,
                name=cfg.entity.name,
                country=cfg.entity.country or None,
                functional_currency=cfg.entity.currency,
                ownership_pct=cfg.entity.ownership_pct,
                pack_filename=cfg.entity.file or None,
                layout_note=cfg.file_format or None,
            )
            session.add(company)
            session.flush()
        else:
            company.name = cfg.entity.name
            company.country = cfg.entity.country or None
            company.functional_currency = cfg.entity.currency
            company.ownership_pct = cfg.entity.ownership_pct
            company.pack_filename = cfg.entity.file or None
            company.layout_note = cfg.file_format or None
        company_by_code[cfg.entity.entity_id] = company
        aliases = list(cfg.entity.aliases) + [cfg.entity.name, cfg.entity.entity_id]
        if cfg.entity.file:
            aliases.append(PurePosixPath(cfg.entity.file).stem)
        seen = {
            a
            for a in session.scalars(
                select(CompanyAlias.alias_normalized).where(CompanyAlias.group_id == group.id)
            )
        }
        for alias in aliases:
            norm = normalize_alias(alias)
            if norm and norm not in seen:
                session.add(
                    CompanyAlias(
                        group_id=group.id,
                        company_id=company.id,
                        alias=alias,
                        alias_normalized=norm,
                    )
                )
                seen.add(norm)
                session.flush()

    if not session.scalar(select(GroupParameter.id).where(GroupParameter.group_id == group.id)):
        for p in state.parameters:
            session.add(
                GroupParameter(
                    group_id=group.id,
                    parameter=p.parameter,
                    scope=p.scope or "group",
                    value=p.value,
                    unit=p.unit,
                    used_for=p.used_for,
                    source=p.source,
                )
            )
        session.flush()

    rate_set = session.scalar(
        select(db_models.FxRateSet)
        .where(db_models.FxRateSet.group_id == group.id)
        .order_by(db_models.FxRateSet.version.desc())
    )
    if rate_set is None:
        rate_set = db_models.FxRateSet(
            group_id=group.id,
            name="pinned",
            version=1,
            reporting_currency=state.meta.reporting_currency,
        )
        session.add(rate_set)
        session.flush()
        for rate in state.rate_set.rates:
            units = state.units.get((rate.from_ccy, rate.rate_type.value, rate.period))
            session.add(
                db_models.FxRate(
                    rate_set_id=rate_set.id,
                    from_ccy=rate.from_ccy,
                    to_ccy=rate.to_ccy,
                    period=rate.period,
                    rate_type=rate.rate_type.value,
                    rate=rate.rate,
                    units_per_usd=Decimal(units) if units else None,
                    applies_to=rate.applies_to,
                    source=rate.source,
                )
            )
        session.flush()

    if state.mappings and not session.scalar(
        select(MappingVersion.id).where(MappingVersion.group_id == group.id)
    ):
        for company_code, entries in state.mappings.items():
            company = company_by_code.get(company_code)
            if company is None:
                continue
            mv = MappingVersion(
                group_id=group.id,
                company_id=company.id,
                version="answer_key_mapping.csv",
                structural={},
                approved_by="seed",
            )
            session.add(mv)
            session.flush()
            for entry in entries:
                account = chart.get(entry.group_account)
                if account is None:
                    continue
                partner = company_by_code.get(entry.counterparty) if entry.counterparty else None
                session.add(
                    AccountMapping(
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

    state.meta = replace(state.meta, uuid=str(group.id), id=group.slug, name=group.name)
    put_state(state)
    return group


def main(argv: list[str]) -> None:
    # python -m kaikei.application.seed grupo-ag fixtures/grupo-ag
    if len(argv) >= 3 and not argv[1].endswith(".csv") and Path(argv[2]).exists():
        slug, pack = argv[1], Path(argv[2])
        name = argv[3] if len(argv) > 3 else None
    else:
        pack = Path(argv[1] if len(argv) > 1 else "fixtures/grupo-ag")
        slug = pack.name
        name = argv[2] if len(argv) > 2 else None
    display = name or ("Grupo AG" if pack.name == "grupo-ag" else slug)
    with session_scope() as session:
        group = seed_group(session, pack, display, slug=slug)
        print(f"group_id={group.id} slug={group.slug} name={group.name}")


if __name__ == "__main__":
    main(sys.argv)
