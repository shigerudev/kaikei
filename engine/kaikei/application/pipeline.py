"""Run orchestration (K8): ingest -> normalize -> validate -> translate -> match -> eliminate
-> aggregate -> publish, over the fixture pack (MANIFESTO §4.1).

Minimal happy-path slice, by explicit scope cut (not a silent drop — each cut is load
bearing and documented inline):

- Companies: **EMP1 + EMP2 only**. That pair alone carries the README's product-sale IC
  flow and the planted E02 mismatch (mar-2027 "Compras a AG Manufactura" 472,500 GTQ vs
  "Ventas a AG Distribución" 427,500 GTQ) — the exact scenario SCOPE_AND_TASKS.md's demo
  and this build's acceptance test exercise. EMP3-EMP6 are out of this slice; any IC leg
  whose counterparty is one of them (management fees to EMP6, EMP2->EMP3 product sales)
  correctly surfaces as a traceable ONE_SIDED finding (VAL-007), never a silent drop.
  Group configuration (`GET /groups/...`) still serves all six entities: it is read from
  `entidades.csv`, independent of which packs this slice consolidates.
  TODO(Jo): the normalizers for EMP3-EMP6's layouts are K2/K3 work; once they land, add
  their packs to `_INGEST` below — nothing else here is company-specific.
- EMP2 format: only its first stacked block (2027 budget P&L, CSV lines 2-17) is read.
  Its balance-sheet and 2026-actual blocks use a different column shape (PLAN.md §6.4
  PARSER-003) and are left for a later slice.
- Validation: only VAL-002 (bad amount), VAL-003 (unmapped account, inherited from
  normalize()), VAL-004/021 (FX), VAL-006 (duplicates), VAL-007/008 (IC) and VAL-013
  (ambiguous elimination) fire here — the full VAL-xxx catalog (VAL-010 subtotals,
  VAL-019 sign, VAL-023 balance, VAL-024 local-FX conflicts, ...) is Jose/Hugo's lane,
  not reimplemented.

Every number still traces to a source cell: nothing above is a silent catch, each cut is
simply never asked to produce a figure it hasn't validated.

Reporting periods are the engine's own: each P&L record rolls into its month *and* the
fiscal year (`chart_of_accounts.period_buckets`), so "FY 2027" is aggregated here from the
same translated contributions rather than summed in the browser (MANIFESTO principle 1).
"""

from __future__ import annotations

import csv
import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation
from pathlib import Path
from uuid import uuid4

# isort: off
# `kaikei.domain.intercompany` must be imported before `kaikei.domain.consolidation`:
# consolidation/journals.py and intercompany/eliminate.py import each other's submodules
# at top level, and importing `consolidation` first trips a circular-import error
# (reproducible with a bare `import kaikei.domain.consolidation`, independent of this
# file). Not this lane's code to fix — just order around it; keep this block unsorted.
from kaikei.domain.intercompany import (
    IcCandidate,
    IcFinding,
    MatchGroup,
    MatchStatus,
    elimination_amount,
    load_entities,
    load_ic_tolerance,
    match_intercompany,
)
from kaikei.domain.consolidation import Journal, build_elimination_journal

# isort: on
from kaikei.application import group_config
from kaikei.application.chart_of_accounts import (
    ACCOUNTS,
    NormalBalance,
    period_buckets,
    statement_of,
)
from kaikei.application.contracts import (
    FindingDecisionOut,
    RunCountsOut,
    RunInputFileOut,
    RunInputsOut,
    RunOut,
    RunStageOut,
)
from kaikei.application.group_config import GroupMeta
from kaikei.application.models import ConsolidatedFact, RunStatus
from kaikei.application.rule_catalog import BALANCE_SCOPE_RULES
from kaikei.domain.fx import (
    CanonicalAmount,
    FxFinding,
    FxRateSet,
    TranslatedRecord,
    load_rate_set,
    translate_records,
)
from kaikei.domain.ingestion.csv_adapter import SourceRow, read_csv_rows
from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.lineage import Lineage, LineageAdjustment, LineageContribution, build_lineage
from kaikei.domain.normalization.long_format import LongAccount, LongLayout, LongMapping
from kaikei.domain.normalization.mapping_loader import load_account_mappings
from kaikei.domain.normalization.models import CanonicalRecord, Statement
from kaikei.domain.normalization.normalize import normalize, parse_period
from kaikei.domain.validation.helpers import finding_id, observed_fields
from kaikei.domain.validation.models import Finding, FindingStatus, Severity
from kaikei.domain.validation.rules import find_duplicates

FIXTURES_DIR = group_config.FIXTURES_ROOT / "grupo-ag"

_EMP2_MONTH_COLUMNS = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
]
_EMP2_BUDGET_ROWS = range(2, 18)  # the 2027-budget block only (see module docstring)

# Which packs this slice consolidates, in company order. Adding a company is a line here
# plus its normalizer — never a branch further down (MANIFESTO principle 8).
_INGEST: tuple[str, ...] = ("EMP1", "EMP2")

_STAGE_LABELS: tuple[tuple[str, str], ...] = (
    ("ingest", "Ingest"),
    ("normalize", "Normalize"),
    ("validate", "Validate"),
    ("translate", "Translate"),
    ("match", "Match IC"),
    ("eliminate", "Eliminate"),
    ("aggregate", "Aggregate"),
)

# Which rules speak for which stage, so a stage's status is read off the findings it owns.
_STAGE_RULES: dict[str, tuple[str, ...]] = {
    "ingest": (),
    "normalize": ("VAL-003",),
    "validate": ("VAL-002", "VAL-006", "VAL-010", "VAL-019", "VAL-020", "VAL-022", "VAL-023"),
    "translate": ("VAL-004", "VAL-021", "VAL-024"),
    "match": ("VAL-007", "VAL-008"),
    "eliminate": ("VAL-013",),
    "aggregate": (),
}

_OPEN_STATUSES = (FindingStatus.OPEN, FindingStatus.UNDER_REVIEW)


class FindingRecord(Finding):
    """K4 `Finding` + the few API-facing fields the rule itself can't know.

    `finding_id` is deterministic from rule + reason + source cells so it survives an
    identical rerun (MANIFESTO: "same inputs -> same fingerprint and facts", AC10).

    `expected`/`difference`/`currency`/`match_group_id` are filled where the engine already
    holds both sides of a comparison (an IC pair, an FX currency check). `company_ids` is
    resolved from the source cells, never guessed. `reference` stays None: it is the fixture
    answer key's own id (E01...E11c) and the engine does not read its own answer sheet.
    """

    match_group_id: str | None = None
    company_ids: list[str] = []
    decisions: list[FindingDecisionOut] = []

    @property
    def id(self) -> str:
        return self.finding_id


@dataclass(frozen=True)
class MatchInfo:
    """What the API needs about a match group beyond K5's own `MatchGroup`."""

    period: str
    journal_id: str | None = None
    finding_id: str | None = None


@dataclass
class RunRecord:
    """Everything one immutable run produced, kept together so the API can shape it."""

    run: RunOut
    group_id: str
    findings: list[FindingRecord]
    facts: list[ConsolidatedFact]
    lineages: dict[str, Lineage]
    matches: list[MatchGroup]
    journals: list[Journal]
    records: dict[str, CanonicalRecord] = field(default_factory=dict)
    raw_cells: dict[tuple[str, int, str], str] = field(default_factory=dict)
    match_info: dict[str, MatchInfo] = field(default_factory=dict)
    rate_set: FxRateSet | None = None
    files: tuple[tuple[str, str, str, int, int], ...] = ()
    """(company_id, filename, sha256, lines ingested, canonical records) per pack."""


RUNS: dict[str, RunRecord] = {}
RUN_ORDER: dict[str, list[str]] = {}
DECISIONS: dict[str, tuple[FindingStatus, list[FindingDecisionOut]]] = {}
# TODO(Jo): persist runs, findings and decisions once K1 (infrastructure/db) lands. Until
# then these module-level dicts are the only storage boundary — the whole point of the cut.


class PublicationBlockedError(Exception):
    """Raised by `publish_run` while an OPEN BLOCKER remains (MANIFESTO §4.1 gate ⑦)."""

    def __init__(self, run_id: str, open_blockers: list[FindingRecord]) -> None:
        self.run_id = run_id
        self.open_blockers = open_blockers
        super().__init__(f"run {run_id} has {len(open_blockers)} open BLOCKER finding(s)")


class UnknownGroupError(Exception):
    """Raised when a run is asked for a group that isn't configured."""


def _record_id(record: CanonicalRecord) -> str:
    """A canonical record is exactly one source cell: file + row + column identifies it."""
    return f"{record.source.filename}:{record.source.row}:{record.source.column}"


def _money(value: Decimal) -> str:
    """Every figure crosses the API as a decimal string, rounded half-even to the reporting
    scale only here, at the boundary (MANIFESTO principle 5, §4.2 rounding)."""
    return format(value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN), "f")


def _emp1_mapping(fixtures_dir: Path) -> LongMapping:
    structural = LongLayout(
        mapping_version="answer_key_mapping.csv",
        company_id="EMP1",
        period_column="Mes",
        account_column="Cuenta",
        description_column="Descripción",
        amount_column="Monto (GTQ)",
        scenario_column="Escenario",
        currency="GTQ",
        scenario_map={
            "Presupuesto": "BUDGET_2027",
            "Real": "ACTUAL_2026",
            "Balance": "BALANCE_2027",
        },
    )
    accounts = load_account_mappings(fixtures_dir / "answer_key_mapping.csv", "EMP1")
    return LongMapping(structural=structural, accounts=accounts)


def _normalize_emp2_budget(
    rows: list[SourceRow], accounts: dict[str, LongAccount]
) -> tuple[list[CanonicalRecord], list[Finding]]:
    """EMP2's 2027-budget monthly block (CSV lines 2-17) reshaped wide -> long by hand.

    Jose's `normalize()` only knows the "long" layout (one amount per row); EMP2 is wide
    (months as columns) with three stacked tables in one file, which is out of this
    slice's scope (see module docstring). Section-header and hardcoded-subtotal rows
    ("Total ingresos", "Utilidad antes de impuestos", ...) are deliberately absent from
    `answer_key_mapping.csv` (Jose's VAL-003/VAL-010 territory) and are skipped here
    without a finding — they are not account data, and flagging them would be a false
    positive this slice has no rule to justify.
    """
    records: list[CanonicalRecord] = []
    findings: list[Finding] = []

    for row in rows:
        if row.row not in _EMP2_BUDGET_ROWS:
            continue
        concept = row.raw.get("Concepto", "").strip()
        account = accounts.get(concept)
        if account is None:
            continue  # section header / subtotal row — see docstring

        for month in _EMP2_MONTH_COLUMNS:
            raw_amount = row.raw.get(month, "").strip()
            if not raw_amount:
                continue  # blank cell: never assumed zero (PLAN.md PARSER-005)

            source = SourceRef(filename=row.filename, sheet=row.sheet, row=row.row, column=month)
            try:
                amount_local = Decimal(raw_amount)
            except InvalidOperation:
                reason = "invalid or missing monetary value"
                findings.append(
                    Finding(
                        finding_id=finding_id("VAL-002", reason, [source]),
                        rule_id="VAL-002",
                        rule_version="v1",
                        severity=Severity.BLOCKER,
                        source_refs=[source],
                        reason=reason,
                        **observed_fields(raw_amount),
                    )
                )
                continue

            records.append(
                CanonicalRecord(
                    record_id=f"{source.filename}:{source.row}:{source.column}",
                    source=source,
                    company_id="EMP2",
                    scenario_id="BUDGET_2027",
                    scenario_year="2027",
                    period=parse_period(f"{month.lower()}-2027"),
                    statement=account.statement,
                    group_account_code=account.group_account_code,
                    local_account_code=concept,
                    local_account_name=concept,
                    amount_local=amount_local,
                    currency="GTQ",
                    mapping_version="emp2-budget-subset-v1",
                )
            )

    return records, findings


def _load_counterparty(path: Path, company_id: str) -> dict[str, str]:
    """IC partner hint per local account, read straight from `answer_key_mapping.csv`'s
    `counterparty` column. K3's `load_account_mappings` (Jose's lane) intentionally
    doesn't carry that column into `AccountMapping` — it's intercompany-matching input,
    not a structural/account-mapping concern, so this lane reads it directly instead of
    asking Jose's loader to grow a field it doesn't need.
    """
    out: dict[str, str] = {}
    with Path(path).open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["entity"] != company_id:
                continue
            counterparty = (row.get("counterparty") or "").strip()
            if counterparty:
                out[row["local_account"].strip()] = counterparty
    return out


def _raw_cells(rows: list[SourceRow]) -> dict[tuple[str, int, str], str]:
    """(file, row, column) -> the cell's own text, so a finding can quote what it read.

    TODO(Jo): `raw` belongs on K2's `SourceRef` (or on `source_rows`, which already keeps
    `raw jsonb` per MANIFESTO §4.2) — the trail is incomplete without the value the engine
    actually saw. Indexed here instead of adding a field to Jose's model.
    """
    return {
        (row.filename, row.row, column): value for row in rows for column, value in row.raw.items()
    }


def _to_canonical_amount(record: CanonicalRecord, record_id: str) -> CanonicalAmount:
    """Adapt K2's real `CanonicalRecord` to fx/translate.py's placeholder shape
    (that module predates CanonicalRecord; converting at the call site, per the task
    brief, instead of editing Hugo's fx/translate.py)."""
    return CanonicalAmount(
        record_id=record_id,
        company_id=record.company_id,
        currency=record.currency,
        amount_local=record.amount_local,
        statement=record.statement.value,
        scenario_year=record.scenario_id[-4:],
        period=record.period,
    )


def _decimal(value: str | None) -> Decimal | None:
    return Decimal(value) if value is not None else None


def _build_record(
    *,
    rule_id: str,
    rule_version: str,
    severity: Severity,
    source_refs: list[SourceRef],
    reason: str,
    observed: str | None = None,
    expected: str | None = None,
    difference: str | None = None,
    currency: str | None = None,
    match_group_id: str | None = None,
) -> FindingRecord:
    """Money arrives as the decimal strings this layer already formats; K4 holds Decimals."""
    return FindingRecord(
        finding_id=finding_id(rule_id, reason, source_refs),
        rule_id=rule_id,
        rule_version=rule_version,
        severity=severity,
        source_refs=source_refs,
        reason=reason,
        expected=_decimal(expected),
        difference=_decimal(difference),
        currency=currency,
        match_group_id=match_group_id,
        **observed_fields(observed),
    )


def _fx_finding_to_record(f: FxFinding, record_index: dict[str, CanonicalRecord]) -> FindingRecord:
    record = record_index.get(f.record_id)
    return _build_record(
        rule_id=f.rule_id,
        rule_version="fx-v1",
        severity=Severity(f.severity),
        source_refs=[record.source] if record is not None else [],
        reason=f.reason,
        observed=f.observed,
        expected=f.expected,
    )


def _ic_finding_to_record(
    f: IcFinding,
    record_index: dict[str, CanonicalRecord],
    *,
    match_group_id: str | None,
    expected: str | None,
    observed: str | None,
    currency: str,
) -> FindingRecord:
    return _build_record(
        rule_id=f.rule_id,
        rule_version="ic-v1",
        severity=Severity(f.severity),
        source_refs=[record_index[rid].source for rid in f.record_ids if rid in record_index],
        reason=f.reason,
        observed=observed,
        expected=expected,
        difference=_money(f.difference) if f.difference is not None else None,
        currency=currency,
        match_group_id=match_group_id,
    )


def _plain_finding_record(f: Finding) -> FindingRecord:
    return FindingRecord(**{name: getattr(f, name) for name in Finding.model_fields})


def _fingerprint(
    file_sha256s: dict[str, str],
    *,
    mapping_version: str,
    rate_set_id: str,
    rule_set_version: str,
    decisions: list[str],
) -> str:
    """SHA-256 of ordered inputs (K8): sorted file hashes + mapping + rate set + rules +
    the recorded decisions. A decision changes the result, so it changes the fingerprint —
    two runs share a fingerprint only when they really were pinned to the same thing."""
    parts = (
        sorted(file_sha256s.values())
        + [mapping_version, rate_set_id, rule_set_version]
        + sorted(decisions)
    )
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def _normal_balance(group_account_code: str) -> NormalBalance | None:
    account = ACCOUNTS.get(group_account_code)
    return None if account is None else account.normal_balance


def _elimination_journals(
    match_result,
    *,
    record_index: dict[str, CanonicalRecord],
) -> tuple[list[Journal], dict[str, str], list[FindingRecord]]:
    """One balanced journal per MATCHED pair, on the accounts the contributions hit.

    `journals_for_matches` (Hugo's) builds journals against its own placeholder accounts
    (`IC_REVENUE`/`IC_COS`), which are not group accounts, so the eliminations would never
    reach the lines they are meant to reverse. The legs are named here instead, from the
    chart of accounts: the credit-normal account (revenue, a liability) takes the debit and
    the debit-normal one (a cost, an asset) takes the credit, so both sides of the flow come
    down by the same amount. Hugo's `build_elimination_journal` still constructs and balances
    the journal — only the account names are supplied by the caller.

    TODO(Hugo): `build_elimination_journal` could take the two legs as (account, company)
    pairs; it currently leaves `JournalLine.company_id` unset, so the API fills it from the
    match members.
    """
    journals: list[Journal] = []
    journal_by_match: dict[str, str] = {}
    findings: list[FindingRecord] = []

    for match in match_result.matches:
        if match.status != MatchStatus.MATCHED:
            continue
        legs: dict[NormalBalance, list[str]] = {NormalBalance.DEBIT: [], NormalBalance.CREDIT: []}
        for member in match.members:
            record = record_index.get(member.record_id)
            if record is None:
                continue
            balance = _normal_balance(record.group_account_code)
            if balance is not None:
                legs[balance].append(record.group_account_code)

        credit_legs = sorted(set(legs[NormalBalance.CREDIT]))
        debit_legs = sorted(set(legs[NormalBalance.DEBIT]))
        if len(credit_legs) != 1 or len(debit_legs) != 1:
            # Not one credit-normal leg against one debit-normal leg: which accounts the
            # elimination would reverse is ambiguous, so nothing is eliminated and the pair
            # stays visible (MANIFESTO §4.1 ⑥, VAL-013).
            findings.append(
                _build_record(
                    rule_id="VAL-013",
                    rule_version="v1",
                    severity=Severity.BLOCKER,
                    source_refs=[
                        record_index[m.record_id].source
                        for m in match.members
                        if m.record_id in record_index
                    ],
                    observed=", ".join(credit_legs + debit_legs),
                    reason=(
                        "elimination accounts are ambiguous: expected one credit-normal and "
                        f"one debit-normal leg, got credit={credit_legs} debit={debit_legs}"
                    ),
                )
            )
            continue

        journal = build_elimination_journal(
            match,
            journal_id=f"ELIM-{match.match_group_id}",
            revenue_account=credit_legs[0],
            cos_account=debit_legs[0],
            amount=elimination_amount(match),
        )
        journals.append(journal)
        journal_by_match[match.match_group_id] = journal.journal_id

    return journals, journal_by_match, findings


def _aggregate(
    *,
    run_id: str,
    group: GroupMeta,
    records: list[CanonicalRecord],
    translated_index: dict[str, TranslatedRecord],
    rate_by_id: dict[str, object],
    journals: list[Journal],
    match_info: dict[str, MatchInfo],
    record_finding_ids: dict[str, list[str]],
    excluded_companies: dict[Statement, frozenset[str]],
) -> tuple[list[ConsolidatedFact], dict[str, Lineage]]:
    """consolidated = Σ translated contributions + Σ signed adjustments (MANIFESTO §4.2).

    Keyed by (statement, reporting period, group account). A P&L record lands in its month
    and in the fiscal year; a balance-sheet record lands in its closing period only.
    """
    Key = tuple[Statement, str, str]
    contributions_by_key: dict[Key, list[LineageContribution]] = {}
    currency_by_key: dict[Key, str] = {}

    for record in records:
        rid = _record_id(record)
        translated = translated_index.get(rid)
        if translated is None:
            continue  # missing rate / currency mismatch: already a Finding, never silently included
        rate = rate_by_id.get(translated.fx_rate_id)
        excluded = record.company_id in excluded_companies.get(record.statement, frozenset())
        for period in period_buckets(record.period, record.statement, group.fiscal_year):
            key = (record.statement, period, record.group_account_code)
            contributions_by_key.setdefault(key, []).append(
                LineageContribution(
                    record_id=rid,
                    company_id=record.company_id,
                    currency_local=translated.currency_local,
                    amount_local=translated.amount_local,
                    fx_rate_id=translated.fx_rate_id,
                    fx_rate=rate.rate if rate is not None else None,
                    amount_group=translated.amount_group,
                    source=record.source,
                    local_account_code=record.local_account_code,
                    description=record.local_account_name or "",
                    excluded=excluded,
                )
            )
            currency_by_key[key] = translated.currency_group

    adjustments_by_key: dict[Key, list[LineageAdjustment]] = {}
    for journal in journals:
        info = match_info.get(journal.match_group_id)
        if info is None:
            continue  # defensive: every journal comes from a known match group
        for line in journal.lines:
            # Both legs of this elimination *reduce* their account's normal-balance
            # magnitude (MANIFESTO §2.2 example: revenue down, cost of sales down by the
            # same amount), regardless of which leg is the debit and which the credit.
            signed = -(line.debit + line.credit)
            statement = statement_of(line.group_account_code)
            for period in period_buckets(info.period, statement, group.fiscal_year):
                key = (statement, period, line.group_account_code)
                adjustments_by_key.setdefault(key, []).append(
                    LineageAdjustment(
                        journal_id=journal.journal_id,
                        match_group_id=journal.match_group_id,
                        rule_id=journal.rule_id,
                        rule_version=journal.rule_version,
                        amount_group=signed,
                        source_record_ids=list(journal.source_record_ids),
                    )
                )
                currency_by_key.setdefault(key, journal.currency)

    facts: list[ConsolidatedFact] = []
    lineages: dict[str, Lineage] = {}
    for key in sorted(
        set(contributions_by_key) | set(adjustments_by_key),
        key=lambda k: (k[0].value, k[1], k[2]),
    ):
        statement, period, group_account_code = key
        contributions = contributions_by_key.get(key, [])
        adjustments = adjustments_by_key.get(key, [])
        finding_ids = sorted(
            {fid for c in contributions for fid in record_finding_ids.get(c.record_id, [])}
        )
        fact_id = f"{run_id}:{statement.value}:{period}:{group_account_code}"
        lineage = build_lineage(
            fact_id=fact_id,
            run_id=run_id,
            group_account_code=group_account_code,
            period=period,
            statement=statement,
            currency=currency_by_key[key],
            contributions=contributions,
            adjustments=adjustments,
            finding_ids=finding_ids,
        )
        lineages[fact_id] = lineage
        facts.append(
            ConsolidatedFact(
                fact_id=fact_id,
                run_id=run_id,
                group_account_code=group_account_code,
                period=period,
                statement=lineage.statement,
                currency=lineage.currency,
                contributions_total=lineage.contributions_total,
                adjustments_total=lineage.adjustments_total,
                amount=lineage.amount,
            )
        )
    return facts, lineages


def _stages(
    *,
    findings: list[FindingRecord],
    counts: RunCountsOut,
    group: GroupMeta,
    files: tuple[tuple[str, str, str, int, int], ...],
    mapping_version: str,
    rate_set_id: str,
    ingested_rows: int,
) -> list[RunStageOut]:
    """The seven stages of MANIFESTO §4.1, each reporting what it actually did.

    A stage's status comes from the findings its own rules raised: an open BLOCKER blocks it,
    any other open finding warns, otherwise it is done. Nothing here is "pending": this build
    runs the stages synchronously, so by the time a run exists they have all been attempted.
    """
    open_findings = [f for f in findings if f.status in _OPEN_STATUSES]

    def status(stage: str) -> str:
        rules = _STAGE_RULES[stage]
        mine = [f for f in open_findings if f.rule_id in rules]
        if any(f.severity == Severity.BLOCKER for f in mine):
            return "blocked"
        return "warning" if mine else "done"

    any_blocker = counts.blockers_open > 0
    details = {
        "ingest": (
            f"{len(files)} files stored with SHA-256 · "
            f"{ingested_rows} rows extracted with their cells"
        ),
        "normalize": f"{counts.records} canonical records · mapping {mapping_version}",
        "validate": f"{len(open_findings)} open findings · {counts.blockers_open} blockers",
        "translate": (
            f"{counts.translated} records to {group.reporting_currency} · rate set {rate_set_id}"
        ),
        "match": (
            f"{counts.matched} matched · {counts.mismatched} mismatch · "
            f"{counts.one_sided} one-sided"
        ),
        "eliminate": f"{counts.journals} balanced journals",
        "aggregate": "Facts = contributions + adjustments",
    }
    stage_status = {key: status(key) for key, _label in _STAGE_LABELS}
    stage_status["aggregate"] = "blocked" if any_blocker else "done"
    return [
        RunStageOut(key=key, label=label, status=stage_status[key], detail=details[key])
        for key, label in _STAGE_LABELS
    ]


def _decision_digest() -> list[str]:
    """`finding:STATUS` for every decided finding — part of what a run is pinned to."""
    return sorted(f"{fid}:{status.value}" for fid, (status, _events) in DECISIONS.items())


def run_consolidation(
    fixtures_dir: Path | None = None,
    *,
    group_id: str = group_config.DEFAULT_GROUP_ID,
    reason: str | None = None,
) -> RunRecord:
    """Ingest -> normalize -> validate -> translate -> match -> eliminate -> aggregate,
    for EMP1 + EMP2 (see module docstring for the exact, deliberate scope cuts)."""
    group = group_config.get_group(group_id)
    if group is None:
        raise UnknownGroupError(group_id)
    fixtures_dir = fixtures_dir or group_config.data_dir(group)
    run_id = str(uuid4())

    entities = load_entities(fixtures_dir / "entidades.csv")
    rate_set = load_rate_set(
        fixtures_dir / "tasas_grupo.csv", reporting_currency=group.reporting_currency
    )
    tolerance = load_ic_tolerance(fixtures_dir / "parametros_grupo.csv")
    rate_by_id = {r.rate_id: r for r in rate_set.rates}
    files_by_company = {
        c.entity.entity_id: c.entity.file for c in group_config.load_companies(group_id)
    }

    emp1_sha, emp1_rows = read_csv_rows(fixtures_dir / files_by_company["EMP1"])
    emp1_records, emp1_findings = normalize(emp1_rows, _emp1_mapping(fixtures_dir))

    emp2_sha, emp2_rows = read_csv_rows(fixtures_dir / files_by_company["EMP2"])
    emp2_accounts = load_account_mappings(fixtures_dir / "answer_key_mapping.csv", "EMP2")
    emp2_records, emp2_findings = _normalize_emp2_budget(emp2_rows, emp2_accounts)

    source_rows = [*emp1_rows, *emp2_rows]
    records = [*emp1_records, *emp2_records]
    record_index = {_record_id(r): r for r in records}

    findings: list[FindingRecord] = [
        _plain_finding_record(f)
        for f in [*emp1_findings, *emp2_findings, *find_duplicates(records)]
    ]

    canonical_amounts = [_to_canonical_amount(r, _record_id(r)) for r in records]
    translation = translate_records(
        canonical_amounts, rate_set=rate_set, run_id=run_id, entities=entities
    )
    translated_index = {t.canonical_record_id: t for t in translation.translated}
    findings += [_fx_finding_to_record(f, record_index) for f in translation.findings]

    counterparty = {
        company_id: _load_counterparty(fixtures_dir / "answer_key_mapping.csv", company_id)
        for company_id in _INGEST
    }
    ic_candidates: list[IcCandidate] = []
    for record in records:
        if record.statement != Statement.PL:
            # Scope cut: `match_intercompany` buckets by (company pair, period) alone, and
            # BS period "2027-12" collides with December's P&L month — mixing a year-end
            # AP/AR balance into the same bucket as the December product-sale flow. BS
            # reconciliation needs its own period handling (a point-in-time balance, not a
            # monthly flow); left for a later slice rather than matched incorrectly here.
            continue
        rid = _record_id(record)
        translated = translated_index.get(rid)
        if translated is None:
            continue
        partner_text = counterparty.get(record.company_id, {}).get(record.local_account_code)
        if not partner_text:
            continue
        ic_candidates.append(
            IcCandidate(
                record_id=rid,
                company_id=record.company_id,
                period=record.period,
                amount_group=translated.amount_group,
                partner_text=partner_text,
            )
        )

    match_result = match_intercompany(
        ic_candidates, entities=entities, run_id=run_id, tolerance=tolerance
    )
    match_by_record = {
        m.record_id: match.match_group_id for match in match_result.matches for m in match.members
    }
    match_period = {
        m.match_group_id: record_index[m.members[0].record_id].period
        for m in match_result.matches
        if m.members[0].record_id in record_index
    }

    ic_records: list[FindingRecord] = []
    for ic_finding in match_result.findings:
        group_id_for_finding = next(
            (match_by_record[rid] for rid in ic_finding.record_ids if rid in match_by_record), None
        )
        expected, observed = _ic_sides(
            ic_finding, match_result.matches, record_index, group_id_for_finding
        )
        ic_records.append(
            _ic_finding_to_record(
                ic_finding,
                record_index,
                match_group_id=group_id_for_finding,
                expected=expected,
                observed=observed,
                currency=group.reporting_currency,
            )
        )
    findings += ic_records

    journals, journal_by_match, journal_findings = _elimination_journals(
        match_result, record_index=record_index
    )
    findings += journal_findings

    finding_by_match = {f.match_group_id: f.id for f in ic_records if f.match_group_id is not None}
    match_info = {
        m.match_group_id: MatchInfo(
            period=match_period.get(m.match_group_id, ""),
            journal_id=journal_by_match.get(m.match_group_id),
            finding_id=finding_by_match.get(m.match_group_id),
        )
        for m in match_result.matches
    }

    # Decisions recorded against earlier runs carry into this one: a decision is an input,
    # so the same decision set always gives the same statuses (MANIFESTO §4.4).
    for f in findings:
        decided = DECISIONS.get(f.id)
        if decided is not None:
            f.status, f.decisions = decided[0], list(decided[1])

    record_finding_ids: dict[str, list[str]] = {}
    for f in findings:
        for ref in f.source_refs:
            candidate_rid = f"{ref.filename}:{ref.row}:{ref.column}"
            if candidate_rid in record_index:
                record_finding_ids.setdefault(candidate_rid, []).append(f.id)

    raw_cells = _raw_cells(source_rows)
    company_by_file = group_config.company_by_file(group_id)
    for f in findings:
        f.company_ids = _company_ids_for(f, record_index, company_by_file)

    excluded = excluded_companies(findings)

    facts, lineages = _aggregate(
        run_id=run_id,
        group=group,
        records=records,
        translated_index=translated_index,
        rate_by_id=rate_by_id,
        journals=journals,
        match_info=match_info,
        record_finding_ids=record_finding_ids,
        excluded_companies=excluded,
    )

    blockers_open = [
        f for f in findings if f.severity == Severity.BLOCKER and f.status in _OPEN_STATUSES
    ]
    status = RunStatus.BLOCKED if blockers_open else RunStatus.DRAFT

    files = tuple(
        (
            company_id,
            files_by_company[company_id],
            sha,
            len(rows),
            sum(1 for r in records if r.company_id == company_id),
        )
        for company_id, sha, rows in (
            ("EMP1", emp1_sha, emp1_rows),
            ("EMP2", emp2_sha, emp2_rows),
        )
    )
    file_sha256s = {filename: sha for _c, filename, sha, _rows, _recs in files}
    decisions = _decision_digest()
    fingerprint = _fingerprint(
        file_sha256s,
        mapping_version=group.mapping_version,
        rate_set_id=rate_set.rate_set_id,
        rule_set_version=group.rule_set_version,
        decisions=decisions,
    )

    counts = RunCountsOut(
        records=len(records),
        held_back=len(records) - len(translated_index),
        translated=len(translated_index),
        matched=sum(1 for m in match_result.matches if m.status == MatchStatus.MATCHED),
        mismatched=sum(1 for m in match_result.matches if m.status == MatchStatus.MISMATCH),
        one_sided=sum(1 for m in match_result.matches if m.status == MatchStatus.ONE_SIDED),
        journals=len(journals),
        findings_open=sum(1 for f in findings if f.status in _OPEN_STATUSES),
        blockers_open=len(blockers_open),
    )

    order = RUN_ORDER.setdefault(group_id, [])
    parent_run_id = order[-1] if order else None
    run = RunOut(
        id=run_id,
        number=len(order) + 1,
        status=status.value,
        fingerprint=fingerprint,
        scenario=group.scenario,
        created_at=datetime.now(UTC),
        parent_run_id=parent_run_id,
        reason=reason or f"Run on the {group.scenario} packs",
        inputs=RunInputsOut(
            files=[
                RunInputFileOut(company_id=company_id, filename=filename, sha256=sha)
                for company_id, filename, sha, _rows, _recs in files
            ],
            mapping_version=group.mapping_version,
            rate_set_id=rate_set.rate_set_id,
            rule_set_version=group.rule_set_version,
            decisions=decisions,
        ),
        stages=_stages(
            findings=findings,
            counts=counts,
            group=group,
            files=files,
            mapping_version=group.mapping_version,
            rate_set_id=rate_set.rate_set_id,
            ingested_rows=len(source_rows),
        ),
        counts=counts,
    )

    record = RunRecord(
        run=run,
        group_id=group_id,
        findings=findings,
        facts=facts,
        lineages=lineages,
        matches=match_result.matches,
        journals=journals,
        records=record_index,
        raw_cells=raw_cells,
        match_info=match_info,
        rate_set=rate_set,
        files=files,
    )
    RUNS[run_id] = record
    order.append(run_id)
    return record


def _ic_sides(
    ic_finding: IcFinding,
    matches: list[MatchGroup],
    record_index: dict[str, CanonicalRecord],
    match_group_id: str | None,
) -> tuple[str | None, str | None]:
    """The two sides of an IC difference, in the reporting currency the engine compared in.

    `expected` is the credit-normal leg (what the seller billed), `observed` the debit-normal
    one (what the buyer booked). Both figures come from the match group; neither is derived
    here, and a one-sided pair reports only the side that exists.
    """
    if match_group_id is None:
        return None, None
    match = next((m for m in matches if m.match_group_id == match_group_id), None)
    if match is None:
        return None, None
    totals: dict[NormalBalance, Decimal] = {
        NormalBalance.CREDIT: Decimal("0"),
        NormalBalance.DEBIT: Decimal("0"),
    }
    seen: dict[NormalBalance, bool] = {NormalBalance.CREDIT: False, NormalBalance.DEBIT: False}
    for member in match.members:
        record = record_index.get(member.record_id)
        if record is None:
            continue
        balance = _normal_balance(record.group_account_code)
        if balance is None:
            continue
        totals[balance] += abs(member.amount_group)
        seen[balance] = True
    expected = _money(totals[NormalBalance.CREDIT]) if seen[NormalBalance.CREDIT] else None
    observed = _money(totals[NormalBalance.DEBIT]) if seen[NormalBalance.DEBIT] else None
    return expected, observed


def _company_ids_for(
    finding: FindingRecord,
    record_index: dict[str, CanonicalRecord],
    company_by_file: dict[str, str],
) -> list[str]:
    """Which companies a finding is about, resolved from its source cells — never guessed."""
    out: list[str] = []
    for ref in finding.source_refs:
        rid = f"{ref.filename}:{ref.row}:{ref.column}"
        record = record_index.get(rid)
        company_id = record.company_id if record is not None else company_by_file.get(ref.filename)
        if company_id is not None and company_id not in out:
            out.append(company_id)
    return out


def excluded_companies(findings: list[FindingRecord]) -> dict[Statement, frozenset[str]]:
    """Companies an open BLOCKER keeps out of a statement's scope (MANIFESTO §4.3 VAL-023)."""
    blocked = {
        company_id
        for f in findings
        if f.rule_id in BALANCE_SCOPE_RULES
        and f.severity == Severity.BLOCKER
        and f.status in _OPEN_STATUSES
        for company_id in f.company_ids
    }
    return {Statement.BS: frozenset(blocked)}


def get_run(run_id: str) -> RunRecord | None:
    return RUNS.get(run_id)


def list_runs(group_id: str) -> list[RunRecord]:
    """Every run for a group, newest first (`GET /consolidations?group_id=`)."""
    return [RUNS[rid] for rid in reversed(RUN_ORDER.get(group_id, [])) if rid in RUNS]


def latest_run(group_id: str) -> RunRecord | None:
    runs = list_runs(group_id)
    return runs[0] if runs else None


def publish_run(run_id: str) -> RunRecord:
    """POST /publish gate: refuse while an OPEN BLOCKER remains (MANIFESTO §4.1 gate ⑦)."""
    record = RUNS[run_id]
    open_blockers = [
        f for f in record.findings if f.severity == Severity.BLOCKER and f.status in _OPEN_STATUSES
    ]
    if open_blockers:
        raise PublicationBlockedError(run_id, open_blockers)
    record.run = record.run.model_copy(update={"status": RunStatus.PUBLISHED.value})
    return record


_DECISION_STATUS: dict[str, FindingStatus] = {
    "RESOLVE": FindingStatus.RESOLVED,
    "ACCEPT_RISK": FindingStatus.ACCEPTED_RISK,
    "REOPEN": FindingStatus.OPEN,
}
_DECISION_VERB: dict[str, str] = {
    "RESOLVE": "Resolved",
    "ACCEPT_RISK": "Accepted",
    "REOPEN": "Reopened",
}


def decide_finding(
    finding_id: str, *, action: str, reason: str, actor: str, group_id: str
) -> RunRecord:
    """Record a decision and start a new run: a decision is an input, and runs are immutable.

    MANIFESTO §4.4: "Resolve or approve (a new run when inputs change)". The decision is kept
    against the finding's stable id, so the next run — and every later rerun — sees it.
    """
    record = latest_run(group_id)
    if record is None:
        raise KeyError(finding_id)
    finding = next((f for f in record.findings if f.id == finding_id), None)
    if finding is None:
        raise KeyError(finding_id)

    _previous, events = DECISIONS.get(finding_id, (finding.status, []))
    status = _DECISION_STATUS[action]
    reference = finding.reference or finding.rule_id

    # Record the new status *before* the run, so the run is genuinely pinned to it: its
    # fingerprint, counts and stages all reflect the decision rather than being patched after.
    DECISIONS[finding_id] = (status, events)
    next_run = run_consolidation(
        group_id=group_id,
        reason=f"{_DECISION_VERB[action]} {reference}: {reason.strip()}",
    )
    event = FindingDecisionOut(
        action=action,
        reason=reason.strip(),
        actor=actor,
        at=next_run.run.created_at,
        resulting_run_id=next_run.run.id,
    )
    DECISIONS[finding_id] = (status, [*events, event])
    for f in next_run.findings:
        decided = DECISIONS.get(f.id)
        if decided is not None:
            f.decisions = list(decided[1])
    return next_run
