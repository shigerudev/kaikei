"""
K1 SQLAlchemy 2 schema (MANIFESTO §4.2, SCOPE §2 K1/K8).

Layers stay separate, each in its own table:
source (source_files, source_rows) -> canonical (canonical_records) -> translated
(translated_records) -> match (match_groups, match_members) -> adjustment
(adjustment_journals/lines, journal_sources) -> consolidated (consolidated_facts).
Findings span every stage. Originals are append-only (trigger in the first migration).

No company, currency or account is hard-coded: everything is a row (group config / mappings).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CHAR,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from kaikei.infrastructure.db.base import (
    MONEY,
    Base,
    ccy,
    created_ts,
    in_check,
    money,
    period_str,
    rate,
    uuid_pk,
)

STATEMENTS = ("PL", "BS")
NORMAL_BALANCES = ("DEBIT", "CREDIT")
RATE_TYPES = ("average", "closing")
RUN_STATUSES = (
    "CREATED",
    "RUNNING",
    "DRAFT",
    "BLOCKED",
    "READY_FOR_REVIEW",
    "PUBLISHED",
    "FAILED",
)
FINDING_STATUSES = ("OPEN", "UNDER_REVIEW", "RESOLVED", "ACCEPTED_RISK", "SUPERSEDED")
SEVERITIES = ("BLOCKER", "WARNING", "INFO")
MATCH_MODES = ("transaction", "aggregate")
MATCH_STATUSES = ("matched", "mismatch", "one_sided", "unmatched")
PERIOD_CHECK = r"period ~ '^[0-9]{4}(-[0-9]{2})?$'"

# --------------------------------------------------------------------------- group config


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid_pk]
    name: Mapped[str] = mapped_column(String(200))
    reporting_currency: Mapped[ccy]
    created_at: Mapped[created_ts]


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (UniqueConstraint("group_id", "name"),)

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    country: Mapped[str | None] = mapped_column(String(2))
    functional_currency: Mapped[ccy]
    ownership_pct: Mapped[Decimal] = mapped_column(Numeric(7, 4), default=Decimal("100"))
    consolidation_method: Mapped[str] = mapped_column(String(32), default="full")


class CompanyAlias(Base):
    __tablename__ = "company_aliases"
    __table_args__ = (UniqueConstraint("group_id", "alias_normalized"),)

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"))
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    alias: Mapped[str] = mapped_column(String(200))
    alias_normalized: Mapped[str] = mapped_column(String(200))


class Scenario(Base):
    __tablename__ = "scenarios"
    __table_args__ = (UniqueConstraint("group_id", "code"),)

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"))
    code: Mapped[str] = mapped_column(String(64))  # e.g. BUDGET_2027, ACTUAL_2026
    fiscal_year: Mapped[int] = mapped_column(Integer)


class GroupAccount(Base):
    __tablename__ = "group_accounts"
    __table_args__ = (
        UniqueConstraint("group_id", "code"),
        CheckConstraint(in_check("statement", STATEMENTS), name="statement"),
        CheckConstraint(in_check("normal_balance", NORMAL_BALANCES), name="normal_balance"),
    )

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"))
    code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(200))
    statement: Mapped[str] = mapped_column(String(2))
    account_type: Mapped[str] = mapped_column(String(64))
    normal_balance: Mapped[str] = mapped_column(String(6))
    ic_eligible: Mapped[bool] = mapped_column(Boolean, default=False)


# --------------------------------------------------------------------------- 1. source


class SourceFile(Base):
    """Immutable original upload. UPDATE/DELETE rejected by DB trigger."""

    __tablename__ = "source_files"
    __table_args__ = (UniqueConstraint("group_id", "sha256"),)

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"))
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id"), index=True)
    filename: Mapped[str] = mapped_column(String(512))
    sha256: Mapped[str] = mapped_column(String(64))
    stored_uri: Mapped[str] = mapped_column(Text)
    uploaded_at: Mapped[created_ts]

    rows: Mapped[list[SourceRow]] = relationship(back_populates="source_file")


class SourceRow(Base):
    """Immutable raw row with sheet/row/cell coordinates. UPDATE/DELETE rejected by trigger."""

    __tablename__ = "source_rows"
    __table_args__ = (
        UniqueConstraint("source_file_id", "sheet", "row_number"),
        CheckConstraint("row_number >= 1", name="row_number_pos"),
    )

    id: Mapped[uuid_pk]
    source_file_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_files.id"), index=True)
    sheet: Mapped[str] = mapped_column(String(200), default="")
    row_number: Mapped[int] = mapped_column(Integer)
    raw: Mapped[dict[str, Any]]  # raw cell values exactly as read (jsonb)
    cell_refs: Mapped[dict[str, Any]]  # column -> cell label, e.g. {"Amount": "D12"}

    source_file: Mapped[SourceFile] = relationship(back_populates="rows")


# --------------------------------------------------------------------------- 2. mappings


class MappingVersion(Base):
    """A versioned mapping set for one company: structural config + account rows."""

    __tablename__ = "mapping_versions"
    __table_args__ = (UniqueConstraint("group_id", "company_id", "version"),)

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"))
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    version: Mapped[str] = mapped_column(String(64))
    structural: Mapped[dict[str, Any]]  # StructuralMapping (layout) as jsonb
    approved_by: Mapped[str | None] = mapped_column(String(200))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[created_ts]


class AccountMapping(Base):
    __tablename__ = "account_mappings"
    __table_args__ = (
        UniqueConstraint("mapping_version_id", "local_code"),
        CheckConstraint("sign_multiplier IN (-1, 1)", name="sign_multiplier"),
    )

    id: Mapped[uuid_pk]
    mapping_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mapping_versions.id"))
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    local_code: Mapped[str] = mapped_column(String(64))
    local_name: Mapped[str | None] = mapped_column(String(200))
    group_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("group_accounts.id"))
    sign_multiplier: Mapped[int] = mapped_column(Integer, default=1)
    fx_policy: Mapped[str | None] = mapped_column(String(64))
    partner_company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id"))
    effective_from: Mapped[str | None] = mapped_column(String(7))


# --------------------------------------------------------------------------- 3. canonical


class CanonicalRecord(Base):
    __tablename__ = "canonical_records"
    __table_args__ = (CheckConstraint(PERIOD_CHECK, name="period_shape"),)

    id: Mapped[uuid_pk]
    source_row_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_rows.id"), index=True)
    source_cell: Mapped[str | None] = mapped_column(String(64))
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    scenario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenarios.id"))
    period: Mapped[period_str]
    group_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("group_accounts.id"))
    amount_local: Mapped[money]
    currency: Mapped[ccy]
    partner_company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id"))
    partner_text: Mapped[str | None] = mapped_column(String(200))
    mapping_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mapping_versions.id"))
    created_at: Mapped[created_ts]


# --------------------------------------------------------------------------- FX


class FxRateSet(Base):
    __tablename__ = "fx_rate_sets"
    __table_args__ = (UniqueConstraint("group_id", "name"),)

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"))
    name: Mapped[str] = mapped_column(String(200))
    reporting_currency: Mapped[ccy]
    created_at: Mapped[created_ts]


class FxRate(Base):
    """`rate` = units of `to_ccy` per 1 `from_ccy`."""

    __tablename__ = "fx_rates"
    __table_args__ = (
        UniqueConstraint("rate_set_id", "from_ccy", "to_ccy", "period", "rate_type"),
        CheckConstraint(in_check("rate_type", RATE_TYPES), name="rate_type"),
        CheckConstraint("rate > 0", name="rate_positive"),
        CheckConstraint(PERIOD_CHECK, name="period_shape"),
    )

    id: Mapped[uuid_pk]
    rate_set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fx_rate_sets.id"), index=True)
    from_ccy: Mapped[ccy]
    to_ccy: Mapped[ccy]
    period: Mapped[period_str]
    rate_type: Mapped[str] = mapped_column(String(8))
    rate: Mapped[rate]
    source: Mapped[str] = mapped_column(String(200))


# --------------------------------------------------------------------------- runs (K8)


class ConsolidationRun(Base):
    """Immutable run. Fingerprint = SHA-256 of inputs in fixed order (K8)."""

    __tablename__ = "consolidation_runs"
    __table_args__ = (
        CheckConstraint(in_check("status", RUN_STATUSES), name="status"),
        CheckConstraint("char_length(fingerprint) = 64", name="fingerprint_len"),
    )

    id: Mapped[uuid_pk]
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"), index=True)
    scenario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenarios.id"))
    rate_set_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fx_rate_sets.id"))
    rule_set_version: Mapped[str] = mapped_column(String(64))
    mapping_version: Mapped[str] = mapped_column(String(64))
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default="CREATED")
    inputs: Mapped[dict[str, Any]]  # file sha256s, mapping versions, rate set (K8 Run.inputs)
    created_at: Mapped[created_ts]
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# --------------------------------------------------------------------------- 4. translated


class TranslatedRecord(Base):
    __tablename__ = "translated_records"
    __table_args__ = (UniqueConstraint("run_id", "canonical_record_id"),)

    id: Mapped[uuid_pk]
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consolidation_runs.id"), index=True)
    canonical_record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("canonical_records.id"))
    fx_rate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fx_rates.id"))
    amount_group: Mapped[money]
    currency_group: Mapped[ccy]


# --------------------------------------------------------------------------- 5. match


class MatchGroup(Base):
    __tablename__ = "match_groups"
    __table_args__ = (
        CheckConstraint(in_check("mode", MATCH_MODES), name="mode"),
        CheckConstraint(in_check("status", MATCH_STATUSES), name="status"),
        UniqueConstraint("id", "run_id"),
    )

    id: Mapped[uuid_pk]
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consolidation_runs.id"), index=True)
    mode: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    difference: Mapped[money]
    tolerance: Mapped[money]
    rule_version: Mapped[str] = mapped_column(String(64))

    members: Mapped[list[MatchMember]] = relationship(back_populates="match_group")


class MatchMember(Base):
    __tablename__ = "match_members"
    __table_args__ = (
        UniqueConstraint("match_group_id", "translated_record_id"),
        # one record in at most one match per run (MANIFESTO §4.1 step 5)
        UniqueConstraint("run_id", "translated_record_id"),
    )

    id: Mapped[uuid_pk]
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consolidation_runs.id"))
    match_group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("match_groups.id"), index=True)
    translated_record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("translated_records.id"))
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    side: Mapped[str] = mapped_column(String(32))
    amount_group: Mapped[money]

    match_group: Mapped[MatchGroup] = relationship(back_populates="members")


# --------------------------------------------------------------------------- 6. adjustment


class AdjustmentJournal(Base):
    """One balanced journal per matched pair and run. Eliminations never edit contributions."""

    __tablename__ = "adjustment_journals"
    __table_args__ = (UniqueConstraint("run_id", "match_group_id"),)

    id: Mapped[uuid_pk]
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consolidation_runs.id"), index=True)
    match_group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("match_groups.id"))
    rule_id: Mapped[str] = mapped_column(String(64))
    rule_version: Mapped[str] = mapped_column(String(64))
    currency: Mapped[ccy]
    created_at: Mapped[created_ts]

    lines: Mapped[list[AdjustmentLine]] = relationship(back_populates="journal")


class AdjustmentLine(Base):
    __tablename__ = "adjustment_lines"
    __table_args__ = (
        CheckConstraint("debit >= 0 AND credit >= 0", name="non_negative"),
        CheckConstraint("(debit > 0) <> (credit > 0)", name="one_side"),
    )

    id: Mapped[uuid_pk]
    journal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("adjustment_journals.id"), index=True)
    group_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("group_accounts.id"))
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id"))
    debit: Mapped[money] = mapped_column(default=Decimal("0"))
    credit: Mapped[money] = mapped_column(default=Decimal("0"))

    journal: Mapped[AdjustmentJournal] = relationship(back_populates="lines")


class JournalSource(Base):
    """Links a journal to the translated records it eliminates (lineage)."""

    __tablename__ = "journal_sources"
    __table_args__ = (UniqueConstraint("journal_id", "translated_record_id"),)

    id: Mapped[uuid_pk]
    journal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("adjustment_journals.id"))
    translated_record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("translated_records.id"))


# --------------------------------------------------------------------------- findings


class ValidationFinding(Base):
    __tablename__ = "validation_findings"
    __table_args__ = (
        CheckConstraint(in_check("severity", SEVERITIES), name="severity"),
        CheckConstraint(in_check("status", FINDING_STATUSES), name="status"),
    )

    id: Mapped[uuid_pk]
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("consolidation_runs.id"), index=True
    )
    rule_id: Mapped[str] = mapped_column(String(64), index=True)
    rule_version: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="OPEN")
    source_row_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_rows.id"))
    source_cell: Mapped[str | None] = mapped_column(String(64))
    affected_record_ids: Mapped[list[Any]]  # uuids of canonical/translated records (jsonb array)
    expected: Mapped[Decimal | None] = mapped_column(MONEY)
    observed: Mapped[Decimal | None] = mapped_column(MONEY)
    difference: Mapped[Decimal | None] = mapped_column(MONEY)
    currency: Mapped[str | None] = mapped_column(CHAR(3))
    reason: Mapped[str] = mapped_column(Text)
    reason_code: Mapped[str | None] = mapped_column(String(64))
    context: Mapped[dict[str, Any] | None]
    created_at: Mapped[created_ts]

    events: Mapped[list[FindingEvent]] = relationship(back_populates="finding")


class FindingEvent(Base):
    """Append-only audit of decisions on a finding; a decision creates a new run."""

    __tablename__ = "finding_events"

    id: Mapped[uuid_pk]
    finding_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("validation_findings.id"), index=True)
    actor: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(String(64))
    reason: Mapped[str | None] = mapped_column(Text)
    resulting_run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("consolidation_runs.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    finding: Mapped[ValidationFinding] = relationship(back_populates="events")


# --------------------------------------------------------------------------- 7. consolidated


class ConsolidatedFact(Base):
    """Facts per run = contributions + adjustments, by group account and period."""

    __tablename__ = "consolidated_facts"
    __table_args__ = (
        UniqueConstraint("run_id", "group_account_id", "period"),
        CheckConstraint(PERIOD_CHECK, name="period_shape"),
    )

    id: Mapped[uuid_pk]
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("consolidation_runs.id"), index=True)
    group_account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("group_accounts.id"))
    period: Mapped[period_str]
    amount_group: Mapped[money]
    currency_group: Mapped[ccy]
