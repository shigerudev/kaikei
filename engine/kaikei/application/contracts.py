"""K6 wire contract: the exact shapes the API publishes (MANIFESTO §4.4, SCOPE §2 K6).

These models are the OpenAPI schema `lib/api/` is generated from, so they mirror
`lib/api/types.ts` field for field — that file is Jordi's hand-written stand-in for this
contract (SCOPE §2 K6), and the engine conforms to it rather than the other way round.

Why a separate set of models from `domain/**/models.py`: the domain contracts are K2/K4/K5
and belong to Jose and Hugo. A reviewer screen needs fields they have no reason to carry (a
source cell's raw text, a rule's title, a per-company breakdown of a fact), so those are
joined on here, at the boundary, instead of growing someone else's model.

**Every amount and rate is a decimal string** (MANIFESTO principle 5). The fields are typed
`str` on purpose: a `Decimal` that reaches JSON as a number is the bug this prevents, and the
engine formats each figure once, where it computes it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["BLOCKER", "WARNING", "INFO"]
FindingStatus = Literal["OPEN", "UNDER_REVIEW", "RESOLVED", "ACCEPTED_RISK", "SUPERSEDED"]
RunStatusName = Literal[
    "CREATED", "RUNNING", "DRAFT", "BLOCKED", "READY_FOR_REVIEW", "PUBLISHED", "FAILED"
]
MatchStatusName = Literal["MATCHED", "MISMATCH", "ONE_SIDED"]
FileStatusName = Literal["MISSING", "UPLOADED", "MAPPING_APPROVED", "REJECTED"]
StatementName = Literal["PL", "BS"]
LineKindName = Literal["line", "subtotal", "total"]
StageKey = Literal[
    "ingest", "normalize", "validate", "translate", "match", "eliminate", "aggregate"
]
StageStatus = Literal["done", "warning", "blocked", "pending"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceRefOut(Contract):
    """The end of every trace: file, sheet, row, column — and the cell's own raw text."""

    file_id: str | None = None
    filename: str
    sheet: str | None = None
    row: int | None = None
    column: str | None = None
    cell: str | None = None
    raw: str | None = None
    note: str | None = None


class GroupOut(Contract):
    id: str
    slug: str
    name: str
    reporting_currency: str
    scenario: str


class CreateGroupRequest(Contract):
    name: str = Field(min_length=1)
    reporting_currency: str
    slug: str | None = None
    scenario: str | None = None
    fiscal_year: str | None = None


class CreateCompanyRequest(Contract):
    name: str = Field(min_length=1)
    country: str
    functional_currency: str
    ownership_pct: str
    aliases: list[str] = []
    code: str | None = None


class CreateFxRateIn(Contract):
    from_ccy: str
    to_ccy: str
    period: str
    rate_type: Literal["average", "closing"]
    rate: str
    units_per_usd: str | None = None
    source: str = ""
    applies_to: str = ""


class CreateRateSetRequest(Contract):
    name: str | None = None
    rates: list[CreateFxRateIn]


class GroupAccountOut(Contract):
    code: str
    name: str
    statement: StatementName
    account_type: str
    normal_balance: str
    ic_eligible: bool


class CompanyOut(Contract):
    id: str
    name: str
    country: str
    functional_currency: str
    ownership_pct: str
    consolidation_method: Literal["FULL"] = "FULL"
    aliases: list[str]
    filename: str
    format: str


class FxRateOut(Contract):
    """Units of `to_ccy` per 1 `from_ccy`, plus the group table's own inverse quote."""

    id: str
    from_ccy: str
    to_ccy: str
    period: str
    rate_type: Literal["average", "closing"]
    rate: str
    units_per_usd: str
    source: str
    applies_to: str = ""


class RateSetOut(Contract):
    id: str
    version: str
    rates: list[FxRateOut]


class ParameterOut(Contract):
    parameter: str
    scope: str
    value: str
    unit: str
    used_for: str
    source: str


class SourceFileOut(Contract):
    id: str
    company_id: str
    filename: str
    sha256: str | None = None
    uploaded_at: datetime | None = None
    status: FileStatusName
    format: str
    rows: int | None = None
    records: int | None = None
    parse_warnings: list[str] = []
    mapping_version: str | None = None


class PreviewRowOut(Contract):
    source: SourceRefOut
    local_account: str
    local_name: str
    period: str
    amount_local: str
    currency: str
    group_account: str | None = None
    partner_company_id: str | None = None
    statement: StatementName


class AccountMappingOut(Contract):
    local_code: str
    local_name: str
    group_account: str
    type: str
    partner: str | None = None


class FilePreviewOut(Contract):
    file_id: str
    rows: list[PreviewRowOut]
    account_mapping: list[AccountMappingOut]


class UploadResultOut(Contract):
    """`POST /files`: the stored original, and whether this exact hash was already imported."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    file: SourceFileOut
    already_imported: bool = Field(alias="alreadyImported")


class RunStageOut(Contract):
    key: StageKey
    label: str
    status: StageStatus
    detail: str


class RunInputFileOut(Contract):
    company_id: str
    filename: str
    sha256: str


class RunInputsOut(Contract):
    """Exactly what the run is pinned to; the fingerprint is the SHA-256 of these, in order."""

    files: list[RunInputFileOut]
    mapping_version: str
    rate_set_id: str
    rule_set_version: str
    decisions: list[str] = []


class RunCountsOut(Contract):
    records: int
    held_back: int
    translated: int
    matched: int
    mismatched: int
    one_sided: int
    journals: int
    findings_open: int
    blockers_open: int


class RunOut(Contract):
    """K8: an immutable, reproducible execution (MANIFESTO §4.1 ⑦)."""

    id: str
    number: int
    status: RunStatusName
    fingerprint: str
    scenario: str
    created_at: datetime
    parent_run_id: str | None = None
    reason: str | None = None
    inputs: RunInputsOut
    stages: list[RunStageOut]
    counts: RunCountsOut


class FactRowOut(Contract):
    """One statement row: Σ contributions + Σ eliminations, with its per-company split."""

    id: str
    group_account: str
    name: str
    statement: StatementName
    kind: LineKindName
    period: str
    contributions_total: str
    adjustments_total: str
    amount: str
    by_company: dict[str, str] = {}
    blocked_companies: list[str] = []
    components: list[str] = []


class FactsOut(Contract):
    run_id: str
    period: str
    statement: StatementName
    currency: str
    rows: list[FactRowOut]


class MatchSideOut(Contract):
    company_id: str
    group_account: str
    record_id: str
    amount_local: str
    currency: str
    amount_group: str
    source: SourceRefOut


class MatchGroupOut(Contract):
    id: str
    flow: str
    mode: Literal["transaction", "aggregate"]
    status: MatchStatusName
    period: str
    seller: MatchSideOut
    buyer: MatchSideOut | None = None
    difference: str
    tolerance: str
    journal_id: str | None = None
    finding_id: str | None = None


class JournalLineOut(Contract):
    group_account: str
    company_id: str
    debit: str
    credit: str


class JournalOut(Contract):
    id: str
    match_group_id: str
    rule_id: str
    rule_version: str
    currency: str
    period: str
    flow: str
    lines: list[JournalLineOut]
    source_record_ids: list[str]
    amount_group: str


class ReconciliationsOut(Contract):
    matches: list[MatchGroupOut]
    journals: list[JournalOut]


class FindingDecisionOut(Contract):
    action: Literal["RESOLVE", "ACCEPT_RISK", "REOPEN"]
    reason: str
    actor: str
    at: datetime
    resulting_run_id: str


class FindingOut(Contract):
    """K4 finding + the catalog row that labels it (see `rule_catalog`)."""

    id: str
    reference: str | None = None
    rule_id: str
    rule_version: str
    severity: Severity
    status: FindingStatus
    title: str
    error_type: str
    company_ids: list[str] = []
    reason: str
    expected_behavior: str
    source_refs: list[SourceRefOut]
    expected: str | None = None
    observed: str | None = None
    difference: str | None = None
    currency: str | None = None
    match_group_id: str | None = None
    affects_publication: bool
    decisions: list[FindingDecisionOut] = []


class LineageRecordOut(Contract):
    id: str
    period: str
    amount_local: str
    amount_group: str
    source: SourceRefOut
    local_account: str
    local_name: str


class LineageContributionOut(Contract):
    company_id: str
    excluded: bool
    currency: str
    amount_local: str
    rate: FxRateOut | None = None
    amount_group: str
    records: list[LineageRecordOut]


class LineageAdjustmentOut(Contract):
    journal_id: str
    match_group_id: str
    rule_id: str
    rule_version: str
    flow: str
    period: str
    amount_group: str
    counterparty: str
    source_record_ids: list[str]


class LineageOut(Contract):
    """The full trace for one consolidated fact (MANIFESTO §3.2 screen 6)."""

    fact_id: str
    group_account: str
    name: str
    period: str
    statement: StatementName
    currency: str
    amount: str
    contributions_total: str
    adjustments_total: str
    contributions: list[LineageContributionOut]
    adjustments: list[LineageAdjustmentOut]
    finding_ids: list[str] = []


class SearchHitOut(Contract):
    kind: Literal["company", "account", "finding", "file", "run"]
    id: str
    title: str
    subtitle: str
    href: str


class StartRunRequest(Contract):
    """`POST /consolidations`: which group to run, and why this run exists."""

    group_id: str | None = None
    reason: str | None = None


class DecisionRequest(Contract):
    """`POST /findings/{id}/decisions`: a decision is auditable, so a reason is required."""

    action: Literal["RESOLVE", "ACCEPT_RISK", "REOPEN"]
    reason: str = Field(min_length=1)
    actor: str = "Reviewer"
