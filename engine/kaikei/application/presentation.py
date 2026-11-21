"""Shape a run's results into the K6 wire contract (MANIFESTO §4.4).

Pure arrangement. Every figure here was already computed by the engine — by `translate_records`,
by the match/elimination rules, by `build_lineage` — and this module only groups, labels and
formats it. The one arithmetic it does is adding up the statement's subtotals and totals from
the group chart of accounts, which is the engine's job too and is why the browser never does
it (MANIFESTO principle 1).

Amounts leave here as decimal strings, formatted once, by `_dec`.
"""

from __future__ import annotations

import re
import unicodedata
from collections import OrderedDict
from decimal import ROUND_HALF_EVEN, Decimal

from kaikei.application import group_config
from kaikei.application.chart_of_accounts import (
    ACCOUNTS,
    LAYOUTS,
    NormalBalance,
    account_name,
    flow_label,
)
from kaikei.application.contracts import (
    CompanyOut,
    FactRowOut,
    FactsOut,
    FindingOut,
    FxRateOut,
    GroupOut,
    JournalLineOut,
    JournalOut,
    LineageAdjustmentOut,
    LineageContributionOut,
    LineageOut,
    LineageRecordOut,
    MatchGroupOut,
    MatchSideOut,
    ParameterOut,
    RateSetOut,
    ReconciliationsOut,
    RunOut,
    SearchHitOut,
    SourceFileOut,
    SourceRefOut,
)
from kaikei.application.group_config import GroupMeta
from kaikei.application.pipeline import FindingRecord, RunRecord, excluded_companies
from kaikei.application.rule_catalog import rule_info
from kaikei.domain.consolidation import Journal
from kaikei.domain.fx.models import FxRate
from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.intercompany import MatchGroup, MatchStatus
from kaikei.domain.lineage import Lineage, LineageContribution
from kaikei.domain.normalization.models import Statement

_ZERO = Decimal("0")
# Money is rounded half-even to the currency's decimals **only here**, at the reporting
# boundary (MANIFESTO §4.2); `NUMERIC(20,4)` is the stored scale, so four places it is.
_MONEY_QUANTUM = Decimal("0.0001")

# K5's own lowercase status vocabulary -> the reviewer-facing one. UNMATCHED means "no
# counterparty was found at all", which is what ONE_SIDED tells the reviewer; the matcher
# only ever labels a MatchGroup with the three below, so the fallback is defensive.
_MATCH_STATUS: dict[MatchStatus, str] = {
    MatchStatus.MATCHED: "MATCHED",
    MatchStatus.MISMATCH: "MISMATCH",
    MatchStatus.ONE_SIDED: "ONE_SIDED",
}


def money(value: Decimal) -> str:
    """One amount, as a decimal string at the reporting scale."""
    return format(value.quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_EVEN), "f")


_money = money


def _dec(value: Decimal) -> str:
    """A non-money decimal (an FX rate, an ownership percentage) at full precision."""
    return format(value, "f")


def file_id(company_id: str) -> str:
    """Stable id for a company's stored original (one pack per company in this slice)."""
    return f"FILE-{company_id}"


# ── Group configuration ──────────────────────────────────────────────────────────


def group_out(group: GroupMeta) -> GroupOut:
    return GroupOut(
        id=group.id,
        name=group.name,
        reporting_currency=group.reporting_currency,
        scenario=group.scenario,
    )


def companies_out(group_id: str) -> list[CompanyOut]:
    return [
        CompanyOut(
            id=c.entity.entity_id,
            name=c.entity.name,
            country=c.entity.country,
            functional_currency=c.entity.currency,
            ownership_pct=_dec(c.entity.ownership_pct),
            consolidation_method="FULL",
            aliases=list(c.entity.aliases),
            filename=c.entity.file,
            format=c.file_format,
        )
        for c in group_config.load_companies(group_id)
    ]


def rate_out(group_id: str, rate: FxRate) -> FxRateOut:
    return FxRateOut(
        id=rate.rate_id,
        from_ccy=rate.from_ccy,
        to_ccy=rate.to_ccy,
        period=rate.period,
        rate_type=rate.rate_type.value,
        rate=_dec(rate.rate),
        units_per_usd=group_config.units_per_usd(
            group_id, rate.from_ccy, rate.rate_type.value, rate.period
        ),
        source=rate.source,
        applies_to=rate.applies_to,
    )


def rate_set_out(group_id: str) -> RateSetOut:
    group = group_config.GROUPS[group_id]
    rate_set, _units = group_config.load_rates(group_id)
    return RateSetOut(
        id=rate_set.rate_set_id,
        version=group.rate_set_version,
        rates=[rate_out(group_id, r) for r in rate_set.rates],
    )


def parameters_out(group_id: str) -> list[ParameterOut]:
    return [
        ParameterOut(
            parameter=row.get("parameter", ""),
            scope=row.get("scope", ""),
            value=row.get("value", ""),
            unit=row.get("unit", ""),
            used_for=row.get("used_for", ""),
            source=row.get("source", ""),
        )
        for row in group_config.load_parameters(group_id)
    ]


# ── Source refs ──────────────────────────────────────────────────────────────────


def source_ref_out(
    record: RunRecord, ref: SourceRef, *, company_id: str | None = None
) -> SourceRefOut:
    """A source cell with the text it actually held, so the inspector can quote it."""
    raw = record.raw_cells.get((ref.filename, ref.row, ref.column))
    if company_id is None:
        company_id = group_config.company_by_file(record.group_id).get(ref.filename)
    return SourceRefOut(
        file_id=file_id(company_id) if company_id else None,
        filename=ref.filename,
        sheet=ref.sheet,
        row=ref.row,
        column=ref.column,
        cell=ref.cell or f"{ref.filename}!{ref.column}{ref.row}",
        raw=raw,
    )


# ── Runs ─────────────────────────────────────────────────────────────────────────


def run_out(record: RunRecord) -> RunOut:
    """A run is already in its published shape; findings decided later change its statuses,
    so the open/blocker counts are recomputed from the findings this record holds."""
    open_findings = [f for f in record.findings if f.status in ("OPEN", "UNDER_REVIEW")]
    blockers = [f for f in open_findings if f.severity == "BLOCKER"]
    counts = record.run.counts.model_copy(
        update={"findings_open": len(open_findings), "blockers_open": len(blockers)}
    )
    return record.run.model_copy(update={"counts": counts})


def runs_out(records: list[RunRecord]) -> list[RunOut]:
    return [run_out(r) for r in records]


# ── Findings ─────────────────────────────────────────────────────────────────────


def finding_out(record: RunRecord, finding: FindingRecord) -> FindingOut:
    info = rule_info(finding.rule_id)
    return FindingOut(
        id=finding.id,
        reference=finding.reference,
        rule_id=finding.rule_id,
        rule_version=finding.rule_version,
        severity=finding.severity.value,
        status=finding.status.value,
        title=info.title,
        error_type=info.error_type,
        company_ids=list(finding.company_ids),
        reason=finding.reason,
        expected_behavior=info.expected_behavior,
        source_refs=[source_ref_out(record, ref) for ref in finding.source_refs],
        expected=finding.expected,
        observed=finding.observed,
        difference=finding.difference,
        currency=finding.currency,
        match_group_id=finding.match_group_id,
        # An open BLOCKER stops publication of its scope (MANIFESTO §4.1 gate ⑦); a decided
        # one no longer does, which is the whole point of recording the decision.
        affects_publication=(
            finding.severity == "BLOCKER" and finding.status in ("OPEN", "UNDER_REVIEW")
        ),
        decisions=list(finding.decisions),
    )


def findings_out(record: RunRecord) -> list[FindingOut]:
    return [finding_out(record, f) for f in record.findings]


# ── Facts: the statement ─────────────────────────────────────────────────────────


def _by_company(lineage: Lineage) -> dict[str, Decimal]:
    """One company, one figure: the records it contributed to this fact, added up."""
    totals: OrderedDict[str, Decimal] = OrderedDict()
    for contribution in lineage.contributions:
        totals[contribution.company_id] = (
            totals.get(contribution.company_id, _ZERO) + contribution.amount_group
        )
    return dict(totals)


def statement_out(record: RunRecord, *, period: str, statement: Statement) -> FactsOut:
    """The statement the reviewer reads: posted lines, then subtotals and totals.

    Leaves come straight from `consolidated_facts`. A leaf with no fact in this run is left
    out of the rows (the run produced no record for it) rather than published as a zero, but
    the subtotals and totals are always present so the reviewer can see the shape of the
    statement — and they are computed here, from the chart of accounts, never in the browser.
    """
    group = group_config.GROUPS[record.group_id]
    reported_period = group.closing_period if statement is Statement.BS else period
    blocked = sorted(excluded_companies(record.findings).get(statement, frozenset()))

    facts = {
        f.group_account_code: f
        for f in record.facts
        if f.statement is statement and f.period == reported_period
    }
    values: dict[str, tuple[Decimal, Decimal, dict[str, Decimal]]] = {}
    rows: list[FactRowOut] = []

    for line in LAYOUTS[statement]:
        if line.kind == "line":
            fact = facts.get(line.code)
            if fact is None:
                continue
            lineage = record.lineages.get(fact.fact_id)
            by_company = _by_company(lineage) if lineage is not None else {}
            values[line.code] = (fact.contributions_total, fact.adjustments_total, by_company)
            row_id = fact.fact_id
        else:
            contributions = _ZERO
            adjustments = _ZERO
            by_company = {}
            for sign, component in line.components:
                part_c, part_a, part_by = values.get(component, (_ZERO, _ZERO, {}))
                factor = Decimal(1) if sign == "+" else Decimal(-1)
                contributions += factor * part_c
                adjustments += factor * part_a
                for company_id, amount in part_by.items():
                    by_company[company_id] = by_company.get(company_id, _ZERO) + factor * amount
            values[line.code] = (contributions, adjustments, by_company)
            row_id = f"{record.run.id}:{statement.value}:{reported_period}:{line.code}"

        contributions, adjustments, by_company = values[line.code]
        rows.append(
            FactRowOut(
                id=row_id,
                group_account=line.code,
                name=account_name(line.code),
                statement=statement.value,
                kind=line.kind,
                period=reported_period,
                contributions_total=_money(contributions),
                adjustments_total=_money(adjustments),
                amount=_money(contributions + adjustments),
                by_company={c: _money(v) for c, v in by_company.items()},
                blocked_companies=blocked,
                components=[code for _sign, code in line.components],
            )
        )

    return FactsOut(
        run_id=record.run.id,
        period=reported_period,
        statement=statement.value,
        currency=group.reporting_currency,
        rows=rows,
    )


# ── Intercompany: matches and journals ───────────────────────────────────────────


def _journal_company_by_account(record: RunRecord, journal: Journal) -> dict[str, str]:
    """Which company holds each account a journal touches, from the records it eliminates."""
    out: dict[str, str] = {}
    for rid in journal.source_record_ids:
        source = record.records.get(rid)
        if source is not None:
            out[source.group_account_code] = source.company_id
    return out


def _journal_flow(journal: Journal) -> str:
    return flow_label([line.group_account_code for line in journal.lines])


def _match_side(record: RunRecord, record_id: str, amount_group: Decimal) -> MatchSideOut | None:
    source = record.records.get(record_id)
    if source is None:
        return None
    return MatchSideOut(
        company_id=source.company_id,
        group_account=source.group_account_code,
        record_id=record_id,
        amount_local=_money(source.amount_local),
        currency=source.currency,
        amount_group=_money(amount_group),
        source=source_ref_out(record, source.source, company_id=source.company_id),
    )


def match_group_out(record: RunRecord, match: MatchGroup) -> MatchGroupOut:
    """A matched or exception pair, seller first.

    "Seller" is the credit-normal leg (the revenue or the receivable) and "buyer" the
    debit-normal one, read off the chart of accounts rather than the matcher's positional
    side labels. A one-sided pair publishes the leg that exists as `seller` and leaves
    `buyer` null — the reviewer screen reads that as "no reciprocal record found", which is
    exactly what happened.
    """
    credit: MatchSideOut | None = None
    debit: MatchSideOut | None = None
    for member in match.members:
        side = _match_side(record, member.record_id, abs(member.amount_group))
        if side is None:
            continue
        account = ACCOUNTS.get(side.group_account)
        if account is not None and account.normal_balance is NormalBalance.CREDIT:
            credit = credit or side
        else:
            debit = debit or side
    seller = credit or debit
    buyer = debit if credit is not None else None
    info = record.match_info.get(match.match_group_id)
    if seller is None:
        # Every member of a match group came from a canonical record, so this cannot happen
        # from data; it would mean the run record lost a record it matched on.
        raise ValueError(f"match group {match.match_group_id} has no resolvable member record")
    return MatchGroupOut(
        id=match.match_group_id,
        flow=flow_label([s.group_account for s in (credit, debit) if s is not None]),
        mode=match.mode.value,
        status=_MATCH_STATUS.get(match.status, "ONE_SIDED"),
        period=info.period if info is not None else "",
        seller=seller,
        buyer=buyer,
        difference=_money(match.difference),
        tolerance=_money(match.tolerance),
        journal_id=info.journal_id if info is not None else None,
        finding_id=info.finding_id if info is not None else None,
    )


def journal_out(record: RunRecord, journal: Journal) -> JournalOut:
    info = record.match_info.get(journal.match_group_id)
    companies = _journal_company_by_account(record, journal)
    amount = max((line.debit + line.credit for line in journal.lines), default=_ZERO)
    return JournalOut(
        id=journal.journal_id,
        match_group_id=journal.match_group_id,
        rule_id=journal.rule_id,
        rule_version=journal.rule_version,
        currency=journal.currency,
        period=info.period if info is not None else "",
        flow=_journal_flow(journal),
        lines=[
            JournalLineOut(
                group_account=line.group_account_code,
                company_id=line.company_id or companies.get(line.group_account_code, ""),
                debit=_money(line.debit),
                credit=_money(line.credit),
            )
            for line in journal.lines
        ],
        source_record_ids=list(journal.source_record_ids),
        amount_group=_money(amount),
    )


def reconciliations_out(record: RunRecord) -> ReconciliationsOut:
    return ReconciliationsOut(
        matches=[match_group_out(record, m) for m in record.matches],
        journals=[journal_out(record, j) for j in record.journals],
    )


# ── Lineage ──────────────────────────────────────────────────────────────────────


def lineage_out(record: RunRecord, fact_id: str) -> LineageOut | None:
    """One fact's full trail: per company, per record, down to the source cell and its text."""
    lineage = record.lineages.get(fact_id)
    if lineage is None:
        return None
    rate_by_id = {r.rate_id: r for r in (record.rate_set.rates if record.rate_set else [])}

    grouped: OrderedDict[str, list[LineageContribution]] = OrderedDict()
    for contribution in lineage.contributions:
        grouped.setdefault(contribution.company_id, []).append(contribution)

    contributions: list[LineageContributionOut] = []
    for company_id, items in grouped.items():
        rate = next((rate_by_id[c.fx_rate_id] for c in items if c.fx_rate_id in rate_by_id), None)
        # A company already reporting in the group currency was never translated: there is
        # no rate to show, and the screen says so rather than quoting an identity of 1.
        published_rate = (
            rate_out(record.group_id, rate)
            if rate is not None and rate.from_ccy != rate.to_ccy
            else None
        )
        contributions.append(
            LineageContributionOut(
                company_id=company_id,
                excluded=any(c.excluded for c in items),
                currency=items[0].currency_local,
                amount_local=_money(sum((c.amount_local for c in items), _ZERO)),
                rate=published_rate,
                amount_group=_money(sum((c.amount_group for c in items), _ZERO)),
                records=[
                    LineageRecordOut(
                        id=c.record_id,
                        period=record.records[c.record_id].period
                        if c.record_id in record.records
                        else lineage.period,
                        amount_local=_money(c.amount_local),
                        amount_group=_money(c.amount_group),
                        source=source_ref_out(record, c.source, company_id=company_id),
                        local_account=c.local_account_code,
                        local_name=c.description,
                    )
                    for c in items
                ],
            )
        )

    journal_by_id = {j.journal_id: j for j in record.journals}
    adjustments: list[LineageAdjustmentOut] = []
    for adjustment in lineage.adjustments:
        journal = journal_by_id.get(adjustment.journal_id)
        companies = _journal_company_by_account(record, journal) if journal else {}
        counterparty = next(
            (c for account, c in companies.items() if account != lineage.group_account_code), ""
        )
        info = record.match_info.get(adjustment.match_group_id)
        adjustments.append(
            LineageAdjustmentOut(
                journal_id=adjustment.journal_id,
                match_group_id=adjustment.match_group_id,
                rule_id=adjustment.rule_id,
                rule_version=adjustment.rule_version,
                flow=_journal_flow(journal) if journal else "Intercompany",
                period=info.period if info is not None else lineage.period,
                # The journal's own amount, as a magnitude: the *row* carries the sign in
                # `adjustments_total` (negative, because an elimination reduces the account),
                # and this is the figure the journal posted. AC7 and the reviewer screen both
                # read it that way — |adjustments_total| = Σ of these lines.
                amount_group=_money(abs(adjustment.amount_group)),
                counterparty=counterparty,
                source_record_ids=list(adjustment.source_record_ids),
            )
        )

    return LineageOut(
        fact_id=lineage.fact_id,
        group_account=lineage.group_account_code,
        name=account_name(lineage.group_account_code),
        period=lineage.period,
        statement=lineage.statement.value,
        currency=lineage.currency,
        amount=_money(lineage.amount),
        contributions_total=_money(lineage.contributions_total),
        adjustments_total=_money(lineage.adjustments_total),
        contributions=contributions,
        adjustments=adjustments,
        finding_ids=list(lineage.finding_ids),
    )


# ── Search ───────────────────────────────────────────────────────────────────────


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_only).strip().casefold()


def search_out(
    group_id: str,
    query: str,
    record: RunRecord | None,
    *,
    files: list[SourceFileOut] | None = None,
    runs: list[RunOut] | None = None,
) -> list[SearchHitOut]:
    """Companies, statement lines, findings, files and runs matching a typed query.

    `files` and `runs` are passed in rather than looked up here: the file registry imports
    this module for its source refs, so the dependency only runs one way."""
    needle = _normalize(query)
    if len(needle) < 2:
        return []
    base = f"/g/{group_id}"
    hits: list[SearchHitOut] = []

    for company in companies_out(group_id):
        haystack = f"{company.id} {company.name} {' '.join(company.aliases)} {company.country}"
        if needle in _normalize(haystack):
            hits.append(
                SearchHitOut(
                    kind="company",
                    id=company.id,
                    title=company.name,
                    subtitle=f"{company.id} · {company.country} · {company.functional_currency}",
                    href=f"{base}/uploads/{company.id}",
                )
            )

    if record is not None:
        group = group_config.GROUPS[group_id]
        facts = statement_out(record, period=group.fiscal_year, statement=Statement.PL)
        for row in facts.rows:
            if needle in _normalize(f"{row.name} {row.group_account}"):
                hits.append(
                    SearchHitOut(
                        kind="account",
                        id=row.id,
                        title=row.name,
                        subtitle=f"{row.group_account} · FY {group.fiscal_year}",
                        href=(
                            f"{base}/inspector/{row.id}"
                            if row.kind == "line"
                            else f"{base}?period={group.fiscal_year}"
                        ),
                    )
                )
        for finding in findings_out(record):
            haystack = (
                f"{finding.reference or ''} {finding.rule_id} {finding.title} "
                f"{finding.reason} {' '.join(finding.company_ids)}"
            )
            if needle in _normalize(haystack):
                hits.append(
                    SearchHitOut(
                        kind="finding",
                        id=finding.id,
                        title=f"{finding.reference or finding.rule_id} · {finding.title}",
                        subtitle=(
                            f"{finding.rule_id} · {finding.severity} · "
                            f"{finding.status.replace('_', ' ').lower()}"
                        ),
                        href=f"{base}/findings/{finding.id}",
                    )
                )

    for source_file in files or []:
        if source_file.status != "MISSING" and needle in _normalize(source_file.filename):
            hits.append(
                SearchHitOut(
                    kind="file",
                    id=source_file.id,
                    title=source_file.filename,
                    subtitle=f"{source_file.company_id} · {source_file.records or 0} records",
                    href=f"{base}/uploads/{source_file.company_id}",
                )
            )

    for run in runs or []:
        if needle in _normalize(f"{run.id} run {run.number} {run.status}"):
            hits.append(
                SearchHitOut(
                    kind="run",
                    id=run.id,
                    title=f"Run #{run.number}",
                    subtitle=(f"{run.status.replace('_', ' ').lower()} · {run.fingerprint[:10]}"),
                    href=f"{base}/runs/{run.id}",
                )
            )

    return hits[:24]
