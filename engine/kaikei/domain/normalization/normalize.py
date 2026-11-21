"""Structural + account mapping -> CanonicalRecord, happy path (MANIFESTO §4.1 ②).

Minimal slice: one "long" layout (period, account, description, amount, scenario
columns). A blank account cell is a known structural feature (e.g. a trailing
note row) and is skipped silently. A non-blank account that the mapping does
not know becomes a VAL-003 finding instead of a dropped row — nothing
uncertain is accepted silently.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

from kaikei.domain.ingestion.models import SourceRef, SourceRow
from kaikei.domain.normalization.models import CanonicalRecord, MappingConfig
from kaikei.domain.validation.models import Finding, Severity

_SPANISH_MONTHS = {
    "ene": 1,
    "feb": 2,
    "mar": 3,
    "abr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dic": 12,
}

_MONTH_YEAR_RE = re.compile(r"^([a-záéíóú]{3})-(\d{4})$", re.IGNORECASE)
_DMY_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")
_TOTAL_YEAR_RE = re.compile(r"^total\s+(\d{4})$", re.IGNORECASE)


def parse_period(raw: str) -> str:
    """ "ene-2027" -> "2027-01"; "31/12/2027" -> "2027-12"; "Total 2026" -> "2026"."""
    value = raw.strip()

    month_year = _MONTH_YEAR_RE.match(value)
    if month_year:
        month = _SPANISH_MONTHS.get(month_year.group(1).lower())
        if month is not None:
            return f"{month_year.group(2)}-{month:02d}"

    dmy = _DMY_RE.match(value)
    if dmy:
        _day, month, year = dmy.groups()
        return f"{year}-{int(month):02d}"

    total_year = _TOTAL_YEAR_RE.match(value)
    if total_year:
        return total_year.group(1)

    raise ValueError(f"unrecognized period {raw!r}")


def normalize(
    rows: list[SourceRow],
    mapping: MappingConfig,
) -> tuple[list[CanonicalRecord], list[Finding]]:
    """Apply one company's structural + account mapping to its raw rows."""
    structural = mapping.structural
    records: list[CanonicalRecord] = []
    findings: list[Finding] = []

    for row in rows:
        local_code = row.raw[structural.account_column].strip()
        if not local_code:
            continue  # blank account: a known non-data row (e.g. a trailing note), not a finding

        account = mapping.accounts.get(local_code)
        source = SourceRef(
            filename=row.filename,
            sheet=row.sheet,
            row=row.row,
            column=structural.amount_column,
        )
        if account is None:
            findings.append(
                Finding(
                    rule_id="VAL-003",
                    rule_version="v1",
                    severity=Severity.BLOCKER,
                    source_refs=[source],
                    observed=local_code,
                    reason=f"account {local_code!r} is not in {structural.company_id}'s mapping",
                )
            )
            continue

        raw_amount = row.raw[structural.amount_column].strip()
        try:
            amount_local = Decimal(raw_amount)
        except InvalidOperation:
            findings.append(
                Finding(
                    rule_id="VAL-002",
                    rule_version="v1",
                    severity=Severity.BLOCKER,
                    source_refs=[source],
                    observed=raw_amount,
                    reason="invalid or missing monetary value",
                )
            )
            continue

        scenario_raw = row.raw[structural.scenario_column].strip()
        scenario_id = structural.scenario_map.get(scenario_raw, scenario_raw)

        records.append(
            CanonicalRecord(
                source=source,
                company_id=structural.company_id,
                scenario_id=scenario_id,
                period=parse_period(row.raw[structural.period_column]),
                statement=account.statement,
                group_account_code=account.group_account_code,
                local_account_code=local_code,
                description=row.raw[structural.description_column].strip(),
                amount_local=amount_local,
                currency=structural.currency,
                mapping_version=structural.mapping_version,
            )
        )

    return records, findings
