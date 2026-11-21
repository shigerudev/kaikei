"""Idempotent seed of a group + companies from a fixture pack (configuration from data).

Usage: uv run python -m kaikei.application.seed [fixtures/grupo-ag] [group name]
Reads entidades.csv and parametros_grupo.csv; hard-codes no company, currency or account.
"""

from __future__ import annotations

import csv
import sys
from decimal import Decimal
from pathlib import Path, PurePosixPath

from sqlalchemy import select
from sqlalchemy.orm import Session

from kaikei.application.uploads import normalize_alias
from kaikei.infrastructure.db.models import Company, CompanyAlias, Group
from kaikei.infrastructure.db.session import session_scope


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def seed_group(session: Session, pack: Path, group_name: str) -> Group:
    params = _rows(pack / "parametros_grupo.csv")
    reporting = next((p["value"] for p in params if p["parameter"] == "reporting_currency"), None)
    if not reporting:
        raise ValueError("parametros_grupo.csv has no reporting_currency")
    group = session.scalar(select(Group).where(Group.name == group_name))
    if group is None:
        group = Group(name=group_name, reporting_currency=reporting)
        session.add(group)
        session.flush()
    for ent in _rows(pack / "entidades.csv"):
        company = session.scalar(
            select(Company).where(Company.group_id == group.id, Company.name == ent["name"])
        )
        if company is None:
            company = Company(
                group_id=group.id,
                name=ent["name"],
                country=ent["country"] or None,
                functional_currency=ent["currency"],
                ownership_pct=Decimal(ent["ownership_pct"]),
            )
            session.add(company)
            session.flush()
        aliases = [a for a in ent.get("aliases", "").split("|") if a]
        aliases += [ent["name"], ent["entity"], PurePosixPath(ent["file"]).stem]
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
    return group


def main(argv: list[str]) -> None:
    pack = Path(argv[1] if len(argv) > 1 else "fixtures/grupo-ag")
    name = argv[2] if len(argv) > 2 else "Grupo AG"
    with session_scope() as session:
        group = seed_group(session, pack, name)
        print(f"group_id={group.id} name={group.name}")


if __name__ == "__main__":
    main(sys.argv)
