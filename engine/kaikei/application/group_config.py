"""Group configuration behind `GET /groups/{id}` and friends (MANIFESTO §4.4, SCOPE §1.1.1).

Entities, the pinned rate set and the group parameters all come from the group's own data
files — `entidades.csv`, `tasas_grupo.csv`, `parametros_grupo.csv` — read through the loaders
that already own them (`load_entities`, `load_rate_set`). Nothing about a company, a currency
or an account is written in Python here.

What *is* written here is the group register itself (`GROUPS`): the id, display name,
reporting currency, scenario and fiscal calendar. K1 (the `groups` table) isn't built yet, so
this declarative table stands in for it.

TODO(Jo): move `GROUPS` into the `groups`/`scenarios` tables when K1 lands; this module then
becomes the query, not the register.
TODO(Jordi): `name`, `scenario` and the fiscal calendar would sit naturally in group
configuration next to `parametros_grupo.csv`; `fixtures/` is K7's lane, so they live here.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from kaikei.domain.fx.models import FxRateSet
from kaikei.domain.fx.rates import load_rate_set
from kaikei.domain.intercompany.aliases import Entity, load_entities

FIXTURES_ROOT = Path(__file__).resolve().parents[3] / "fixtures"


@dataclass(frozen=True)
class GroupMeta:
    """One consolidation group (MANIFESTO §4.2 `groups` + `scenarios`)."""

    id: str
    name: str
    reporting_currency: str
    scenario: str
    fiscal_year: str
    closing_period: str  # the balance-sheet period, MANIFESTO §4.2 "period of its closing date"
    data_dirname: str
    mapping_version: str = "answer_key_mapping.csv"
    rule_set_version: str = "v1"
    rate_set_version: str = "1"


GROUPS: dict[str, GroupMeta] = {
    "grupo-ag": GroupMeta(
        id="grupo-ag",
        name="Grupo AG",
        reporting_currency="USD",
        scenario="BUDGET_2027",
        fiscal_year="2027",
        closing_period="2027-12",
        data_dirname="grupo-ag",
    ),
}

DEFAULT_GROUP_ID = "grupo-ag"


def get_group(group_id: str) -> GroupMeta | None:
    return GROUPS.get(group_id)


def data_dir(group: GroupMeta) -> Path:
    return FIXTURES_ROOT / group.data_dirname


@dataclass(frozen=True)
class CompanyConfig:
    """An entity as the reviewer screens show it: the K5 `Entity` plus its file layout note."""

    entity: Entity
    file_format: str


@lru_cache(maxsize=8)
def load_companies(group_id: str) -> tuple[CompanyConfig, ...]:
    """Entities from `entidades.csv`, in file order.

    `load_entities` (K5, Hugo's lane) stays the single parser for the entity fields the
    matcher needs. The `format` column is a human description of the pack's layout, which
    `Entity` has no reason to carry, so it is joined on here from the same file.
    """
    group = GROUPS[group_id]
    path = data_dir(group) / "entidades.csv"
    entities = load_entities(path)
    with path.open(newline="", encoding="utf-8") as fh:
        formats = {
            (row.get("entity") or "").strip(): (row.get("format") or "").strip()
            for row in csv.DictReader(fh)
        }
    return tuple(
        CompanyConfig(entity=e, file_format=formats.get(e.entity_id, "")) for e in entities
    )


def company_ids(group_id: str) -> tuple[str, ...]:
    return tuple(c.entity.entity_id for c in load_companies(group_id))


def company_by_file(group_id: str) -> dict[str, str]:
    """filename -> company id, so a finding's source cell can name the company that sent it."""
    return {c.entity.file: c.entity.entity_id for c in load_companies(group_id) if c.entity.file}


@lru_cache(maxsize=8)
def load_rates(group_id: str) -> tuple[FxRateSet, tuple[tuple[tuple[str, str, str], str], ...]]:
    """The pinned rate set, plus each row's `units_per_usd` exactly as the group table writes it.

    `load_rate_set` (K5) keeps `rate` = units of USD per 1 local unit, which is the direction
    the engine translates with. The reviewer screens quote the inverse ("1 USD = 7.75 GTQ"), so
    the published string is taken from the source column rather than divided out here — the
    group table is the authority on both sides of its own quote.
    """
    group = GROUPS[group_id]
    path = data_dir(group) / "tasas_grupo.csv"
    rate_set = load_rate_set(path, reporting_currency=group.reporting_currency)
    units: dict[tuple[str, str, str], str] = {}
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            currency = (row.get("currency") or "").strip().upper()
            if not currency:
                continue
            key = (
                currency,
                (row.get("rate_type") or "").strip().lower(),
                (row.get("period") or "").strip(),
            )
            units[key] = (row.get("units_per_usd") or "").strip()
    return rate_set, tuple(units.items())


def units_per_usd(group_id: str, from_ccy: str, rate_type: str, period: str) -> str:
    """`units_per_usd` for one rate row; the quote's own currency+period identifies it."""
    _, items = load_rates(group_id)
    table = dict(items)
    exact = table.get((from_ccy, rate_type, period))
    if exact is not None:
        return exact
    for (currency, _rate_type, row_period), value in table.items():
        if currency == from_ccy and row_period == period:
            return value
    return ""


@lru_cache(maxsize=8)
def load_parameters(group_id: str) -> tuple[dict[str, str], ...]:
    """`parametros_grupo.csv` rows verbatim (parameter, scope, value, unit, used_for, source)."""
    group = GROUPS[group_id]
    with (data_dir(group) / "parametros_grupo.csv").open(newline="", encoding="utf-8") as fh:
        return tuple(
            {key: (value or "").strip() for key, value in row.items() if key}
            for row in csv.DictReader(fh)
            if (row.get("parameter") or "").strip()
        )
