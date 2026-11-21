"""Validation rule catalog, happy-path slice (MANIFESTO §4.3): VAL-006 duplicates."""

from __future__ import annotations

from kaikei.domain.normalization.models import CanonicalRecord
from kaikei.domain.validation.helpers import finding_id
from kaikei.domain.validation.models import Finding, Severity


def _duplicate_key(record: CanonicalRecord) -> tuple[str, str, str, str, str]:
    return (
        record.company_id,
        record.group_account_code,
        record.period,
        format(record.amount_local, "f"),
        record.local_account_name,
    )


def find_duplicates(records: list[CanonicalRecord]) -> list[Finding]:
    """VAL-006: same company, account, period, amount and description more than once.

    Counted once per duplicate set (MANIFESTO §4.3) and traced back to every
    source cell it came from, not just the second occurrence.
    """
    groups: dict[tuple[str, str, str, str, str], list[CanonicalRecord]] = {}
    for record in records:
        groups.setdefault(_duplicate_key(record), []).append(record)

    findings: list[Finding] = []
    for group in groups.values():
        if len(group) < 2:
            continue
        source_refs = [record.source for record in group]
        reason = (
            f"duplicate record: {group[0].company_id}/{group[0].group_account_code} "
            f"{group[0].period} {group[0].local_account_name!r} appears {len(group)} times"
        )
        findings.append(
            Finding(
                finding_id=finding_id("VAL-006", reason, source_refs),
                rule_id="VAL-006",
                rule_version="v1",
                severity=Severity.WARNING,
                source_refs=source_refs,
                observed=group[0].amount_local,
                reason=reason,
            )
        )
    return findings
