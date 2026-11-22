"""Turn ingested source rows into canonical records.

Layout comes from the adapter, not the company.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from kaikei.application.chart_of_accounts import ACCOUNTS, NormalBalance
from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.ingestion.rows import SourceRow
from kaikei.domain.normalization.long_format import LongAccount
from kaikei.domain.normalization.models import CanonicalRecord
from kaikei.domain.normalization.normalize import parse_period
from kaikei.domain.validation.helpers import finding_id, observed_fields
from kaikei.domain.validation.models import Finding, Severity


def _dec(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _local_code(row: SourceRow) -> str:
    roles = row.roles
    for role in ("account", "label"):
        header = roles.get(role)
        if header and header in row.cells:
            return (row.cells[header].raw or "").strip()
    return ""


def _description(row: SourceRow) -> str:
    header = row.roles.get("description") or row.roles.get("label")
    if header and header in row.cells:
        return (row.cells[header].raw or "").strip()
    return _local_code(row)


_SCENARIO_ALIASES = {
    "Presupuesto": "BUDGET_2027",
    "Real": "ACTUAL_2026",
    "Balance": "BALANCE_2027",
    "Budget": "BUDGET_2027",
    "Actual": "ACTUAL_2026",
}


def _scenario(row: SourceRow, default: str) -> str:
    header = row.roles.get("scenario")
    if header and header in row.cells:
        raw = (row.cells[header].raw or "").strip()
        if raw:
            return raw
    return default


def _scenario_parts(raw: str, default: str) -> tuple[str, str]:
    """Map a source label to (scenario_id, YYYY). Unknown labels keep the group's default."""
    if raw in _SCENARIO_ALIASES:
        scenario_id = _SCENARIO_ALIASES[raw]
    elif len(raw) >= 4 and raw[-4:].isdigit():
        scenario_id = raw
    else:
        scenario_id = default
    year = scenario_id[-4:] if len(scenario_id) >= 4 and scenario_id[-4:].isdigit() else ""
    if not year and len(default) >= 4 and default[-4:].isdigit():
        year = default[-4:]
    return scenario_id, year


def _period(
    row: SourceRow,
    header: str | None,
    fallback_raw: str,
    default_year: int | None = None,
) -> str | None:
    if row.period:
        return row.period
    if header and row.period_by_column.get(header):
        return row.period_by_column[header]
    candidates: list[str] = []
    if header:
        candidates.append(header)
        if default_year is not None:
            candidates.append(f"{header}-{default_year}")
    if fallback_raw:
        candidates.append(fallback_raw)
    for raw in candidates:
        try:
            return parse_period(raw)
        except ValueError:
            continue
    return None


def _amount_long(row: SourceRow) -> tuple[Decimal | None, SourceRef | None, str]:
    roles = row.roles
    if "amount" in roles and roles["amount"] in row.cells:
        cell = row.cells[roles["amount"]]
        return _dec(cell.value), cell.ref, cell.raw
    if "debit" in roles and "credit" in roles:
        debit_cell = row.cells[roles["debit"]]
        credit_cell = row.cells[roles["credit"]]
        debit = _dec(debit_cell.value) or Decimal("0")
        credit = _dec(credit_cell.value) or Decimal("0")
        ref = credit_cell.ref if credit else debit_cell.ref
        raw = credit_cell.raw if credit else debit_cell.raw
        return debit, ref, raw  # signed below using normal balance
    return None, None, ""


def _signed_dc(
    row: SourceRow, normal: NormalBalance
) -> tuple[Decimal | None, SourceRef | None, str]:
    debit_cell = row.cells[row.roles["debit"]]
    credit_cell = row.cells[row.roles["credit"]]
    debit = _dec(debit_cell.value)
    credit = _dec(credit_cell.value)
    if debit is None and credit is None:
        return None, debit_cell.ref, debit_cell.raw
    d = debit or Decimal("0")
    c = credit or Decimal("0")
    if normal is NormalBalance.DEBIT:
        return d - c, debit_cell.ref, debit_cell.raw or credit_cell.raw
    return c - d, credit_cell.ref, credit_cell.raw or debit_cell.raw


def canonical_from_ingest(
    *,
    filename: str,
    rows: list[SourceRow],
    company_id: str,
    currency: str,
    accounts: dict[str, LongAccount],
    mapping_version: str,
    default_scenario: str,
    default_year: int | None = None,
) -> tuple[list[CanonicalRecord], list[Finding]]:
    """Map adapter rows to canonical records. Unmapped accounts become VAL-003, never dropped."""
    records: list[CanonicalRecord] = []
    findings: list[Finding] = []

    for row in rows:
        if row.kind != "data":
            continue
        local_code = _local_code(row)
        if not local_code:
            continue
        account = accounts.get(local_code)
        chart = ACCOUNTS.get(account.group_account_code) if account else None

        dated_cols = [
            (h, row.cells[h])
            for h in row.period_by_column
            if h in row.cells and "total_column" not in row.cells[h].flags
        ]
        if dated_cols:
            if account is None:
                source = (
                    next(iter(row.cells.values())).ref
                    if row.cells
                    else SourceRef(filename=filename, row=row.row)
                )
                reason = f"account {local_code!r} is not in {company_id}'s mapping"
                findings.append(
                    Finding(
                        finding_id=finding_id("VAL-003", reason, [source]),
                        rule_id="VAL-003",
                        rule_version="v1",
                        severity=Severity.BLOCKER,
                        source_refs=[source],
                        reason=reason,
                        **observed_fields(local_code),
                    )
                )
                continue
            for header, cell in dated_cols:
                if cell.value is None:
                    continue
                amount = _dec(cell.value)
                period = _period(row, header, "", default_year)
                source = cell.ref
                if period is None:
                    continue
                if amount is None:
                    reason = "invalid or missing monetary value"
                    findings.append(
                        Finding(
                            finding_id=finding_id("VAL-002", reason, [source]),
                            rule_id="VAL-002",
                            rule_version="v1",
                            severity=Severity.BLOCKER,
                            source_refs=[source],
                            reason=reason,
                            **observed_fields(cell.raw),
                        )
                    )
                    continue
                scenario_id, scenario_year = _scenario_parts(
                    _scenario(row, default_scenario), default_scenario
                )
                if not scenario_year:
                    continue
                records.append(
                    CanonicalRecord(
                        record_id=f"{filename}:{row.row}:{header}",
                        source=source,
                        company_id=company_id,
                        scenario_id=scenario_id,
                        scenario_year=scenario_year,
                        period=period,
                        statement=account.statement,
                        group_account_code=account.group_account_code,
                        local_account_code=local_code,
                        local_account_name=_description(row),
                        amount_local=amount,
                        currency=currency,
                        mapping_version=mapping_version,
                    )
                )
            continue

        source_fallback = SourceRef(filename=filename, row=row.row, column=_local_code(row)[:20])
        if "debit" in row.roles and "credit" in row.roles and account is not None:
            normal = chart.normal_balance if chart else NormalBalance.DEBIT
            amount, source, raw = _signed_dc(row, normal)
        else:
            amount, source, raw = _amount_long(row)
        source = source or source_fallback
        if account is None:
            reason = f"account {local_code!r} is not in {company_id}'s mapping"
            findings.append(
                Finding(
                    finding_id=finding_id("VAL-003", reason, [source]),
                    rule_id="VAL-003",
                    rule_version="v1",
                    severity=Severity.BLOCKER,
                    source_refs=[source],
                    reason=reason,
                    **observed_fields(local_code),
                )
            )
            continue
        if amount is None:
            reason = "invalid or missing monetary value"
            findings.append(
                Finding(
                    finding_id=finding_id("VAL-002", reason, [source]),
                    rule_id="VAL-002",
                    rule_version="v1",
                    severity=Severity.BLOCKER,
                    source_refs=[source],
                    reason=reason,
                    **observed_fields(raw),
                )
            )
            continue
        period = _period(row, None, "", default_year)
        if period is None:
            header = row.roles.get("period")
            raw_p = row.cells[header].raw if header and header in row.cells else ""
            try:
                period = parse_period(raw_p) if raw_p else None
            except ValueError:
                period = None
        if period is None:
            continue
        scenario_id, scenario_year = _scenario_parts(
            _scenario(row, default_scenario), default_scenario
        )
        if not scenario_year:
            continue
        records.append(
            CanonicalRecord(
                record_id=f"{filename}:{row.row}:{source.column or 'amount'}",
                source=source,
                company_id=company_id,
                scenario_id=scenario_id,
                scenario_year=scenario_year,
                period=period,
                statement=account.statement,
                group_account_code=account.group_account_code,
                local_account_code=local_code,
                local_account_name=_description(row),
                amount_local=amount,
                currency=currency,
                mapping_version=mapping_version,
            )
        )
    return records, findings
