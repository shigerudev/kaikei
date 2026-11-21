"""Group configuration for the API and the in-memory pipeline (MANIFESTO §4.4, D1).

The register is Postgres (`groups`, `companies`, `fx_rate_sets`, `group_parameters`,
`group_accounts`, mappings). An in-process snapshot is filled from the database on first
lookup, and tests / the seed helper can put a snapshot without opening `fixtures/` on a
request — `FIXTURES_ROOT` lives only on the seed command and in tests.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from threading import Lock

from kaikei.domain.fx.models import FxRateSet
from kaikei.domain.intercompany.aliases import Entity
from kaikei.domain.normalization.long_format import LongAccount
from kaikei.domain.normalization.models import Statement

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


@dataclass(frozen=True)
class GroupMeta:
    """One consolidation group as the pipeline and K6 GroupOut see it.

    `id` is the URL-safe slug (D5). `uuid` is the table primary key.
    """

    id: str
    name: str
    reporting_currency: str
    scenario: str
    fiscal_year: str
    closing_period: str
    uuid: str = ""
    mapping_version: str = "v1"
    rule_set_version: str = "v1"
    rate_set_version: str = "1"


@dataclass(frozen=True)
class CompanyConfig:
    """An entity as the reviewer screens show it: the K5 `Entity` plus its file layout note."""

    entity: Entity
    file_format: str
    uuid: str = ""


@dataclass(frozen=True)
class MappingEntry:
    local_code: str
    local_name: str
    group_account: str
    account_type: str
    counterparty: str | None = None


@dataclass(frozen=True)
class ParameterRow:
    parameter: str
    scope: str
    value: str
    unit: str
    used_for: str
    source: str


@dataclass
class GroupState:
    """In-process snapshot of one group's configuration (not pack bytes)."""

    meta: GroupMeta
    companies: tuple[CompanyConfig, ...]
    rate_set: FxRateSet
    units: dict[tuple[str, str, str], str]
    parameters: tuple[ParameterRow, ...]
    mappings: dict[str, tuple[MappingEntry, ...]] = field(default_factory=dict)
    accounts: tuple[tuple[str, str, str, str, str, bool], ...] = ()
    """(code, name, statement, account_type, normal_balance, ic_eligible)"""
    pack_root: Path | None = None
    """Pack CSV directory for the in-memory pipeline slice (tests/seed; Phase 2 uses storage)."""


_LOCK = Lock()
_BY_KEY: dict[str, GroupState] = {}


def slugify(name: str) -> str:
    slug = _SLUG_RE.sub("-", name.strip().casefold()).strip("-")
    return slug or "group"


def is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value or ""))


def put_state(state: GroupState) -> None:
    """Register a snapshot under both slug and UUID (tests and seed)."""
    with _LOCK:
        previous = _BY_KEY.get(state.meta.id)
        if previous is not None and state.pack_root is None:
            state.pack_root = previous.pack_root
        _BY_KEY[state.meta.id] = state
        if state.meta.uuid:
            _BY_KEY[state.meta.uuid] = state


def drop_all() -> None:
    with _LOCK:
        _BY_KEY.clear()


def list_states() -> list[GroupState]:
    seen: set[str] = set()
    out: list[GroupState] = []
    with _LOCK:
        for state in _BY_KEY.values():
            if state.meta.id in seen:
                continue
            seen.add(state.meta.id)
            out.append(state)
    return sorted(out, key=lambda s: s.meta.name.casefold())


def list_group_ids() -> list[str]:
    return [s.meta.id for s in list_states()]


def get_state(group_id: str) -> GroupState | None:
    with _LOCK:
        hit = _BY_KEY.get(group_id)
    if hit is not None:
        return hit
    loaded = _load_from_db(group_id)
    if loaded is not None:
        put_state(loaded)
    return loaded


def get_group(group_id: str) -> GroupMeta | None:
    state = get_state(group_id)
    return None if state is None else state.meta


def pack_dir(group_id: str) -> Path | None:
    state = get_state(group_id)
    return None if state is None else state.pack_root


def load_companies(group_id: str) -> tuple[CompanyConfig, ...]:
    state = get_state(group_id)
    return () if state is None else state.companies


def company_ids(group_id: str) -> tuple[str, ...]:
    return tuple(c.entity.entity_id for c in load_companies(group_id))


def company_by_file(group_id: str) -> dict[str, str]:
    """filename -> company id, so a finding's source cell can name the company that sent it."""
    return {c.entity.file: c.entity.entity_id for c in load_companies(group_id) if c.entity.file}


def load_rates(group_id: str) -> tuple[FxRateSet, tuple[tuple[tuple[str, str, str], str], ...]]:
    state = get_state(group_id)
    if state is None:
        empty = FxRateSet(rate_set_id="", reporting_currency="USD", rates=[])
        return empty, ()
    return state.rate_set, tuple(state.units.items())


def units_per_usd(group_id: str, from_ccy: str, rate_type: str, period: str) -> str:
    _, items = load_rates(group_id)
    table = dict(items)
    exact = table.get((from_ccy, rate_type, period))
    if exact is not None:
        return exact
    for (currency, _rate_type, row_period), value in table.items():
        if currency == from_ccy and row_period == period:
            return value
    return ""


def load_parameters(group_id: str) -> tuple[dict[str, str], ...]:
    state = get_state(group_id)
    if state is None:
        return ()
    return tuple(
        {
            "parameter": p.parameter,
            "scope": p.scope,
            "value": p.value,
            "unit": p.unit,
            "used_for": p.used_for,
            "source": p.source,
        }
        for p in state.parameters
    )


def ic_tolerance(group_id: str, default: Decimal = Decimal("1.00")) -> Decimal:
    for row in load_parameters(group_id):
        if row.get("parameter") == "ic_match_tolerance":
            return Decimal(row.get("value") or str(default))
    return default


def entities(group_id: str) -> list[Entity]:
    return [c.entity for c in load_companies(group_id)]


def account_mappings(group_id: str, company_id: str) -> dict[str, LongAccount]:
    state = get_state(group_id)
    if state is None:
        return {}
    out: dict[str, LongAccount] = {}
    for entry in state.mappings.get(company_id, ()):
        raw_type = entry.account_type.strip().upper()
        statement = Statement.BS if raw_type.startswith("BS") else Statement.PL
        out[entry.local_code] = LongAccount(
            local_code=entry.local_code,
            group_account_code=entry.group_account,
            statement=statement,
        )
    return out


def counterparties(group_id: str, company_id: str) -> dict[str, str]:
    state = get_state(group_id)
    if state is None:
        return {}
    return {
        e.local_code: e.counterparty for e in state.mappings.get(company_id, ()) if e.counterparty
    }


def mapping_entries(group_id: str, company_id: str) -> tuple[MappingEntry, ...]:
    state = get_state(group_id)
    if state is None:
        return ()
    return state.mappings.get(company_id, ())


def default_group_id() -> str | None:
    ids = list_group_ids()
    if len(ids) == 1:
        return ids[0]
    if not ids:
        loaded = _load_all_from_db()
        if loaded:
            for state in loaded:
                put_state(state)
            ids = list_group_ids()
            if len(ids) == 1:
                return ids[0]
    return None


def _load_from_db(group_id: str) -> GroupState | None:
    session = _try_session()
    if session is None:
        return None
    try:
        from kaikei.application.group_repo import load_state

        return load_state(session, group_id)
    except Exception:
        return None
    finally:
        session.close()


def _load_all_from_db() -> list[GroupState]:
    session = _try_session()
    if session is None:
        return []
    try:
        from kaikei.application.group_repo import load_all_states

        return load_all_states(session)
    except Exception:
        return []
    finally:
        session.close()


def _try_session():  # noqa: ANN201
    try:
        from kaikei.infrastructure.db.session import get_sessionmaker

        return get_sessionmaker()()
    except Exception:
        return None
