"""Intercompany matching after FX translation (PIPER-71 / PLAN.md §8)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from decimal import Decimal

from kaikei.domain.intercompany.aliases import Entity, resolve_alias
from kaikei.domain.intercompany.models import (
    MatchGroup,
    MatchMember,
    MatchMode,
    MatchStatus,
)


@dataclass(frozen=True)
class IcCandidate:
    """A translated record that may participate in an IC pair."""

    record_id: str
    company_id: str
    period: str  # YYYY-MM
    # Reporting-currency amount (use abs magnitude for elimination).
    amount_group: Decimal
    partner_text: str | None = None  # raw counterparty from source / account name
    partner_company_id: str | None = None  # if already resolved
    side: str = "unknown"  # "seller" | "buyer" | "unknown"
    ic_eligible: bool = True


@dataclass(frozen=True)
class IcFinding:
    rule_id: str
    severity: str
    record_ids: tuple[str, ...]
    reason: str
    difference: Decimal | None = None


@dataclass(frozen=True)
class MatchResult:
    matches: list[MatchGroup]
    findings: list[IcFinding]
    unmatched_record_ids: list[str]


def _pair_key(a: str, b: str, period: str) -> str:
    lo, hi = sorted((a, b))
    return f"{lo}|{hi}|{period}"


def _match_id(run_id: str, key: str) -> str:
    return hashlib.sha256(f"{run_id}|{key}".encode()).hexdigest()[:16]


def _resolve_partner(
    cand: IcCandidate,
    entities: list[Entity],
) -> str | None:
    if cand.partner_company_id:
        return cand.partner_company_id
    if not cand.partner_text:
        return None
    hit = resolve_alias(cand.partner_text, entities)
    return hit.entity_id if hit else None


def match_intercompany(
    candidates: list[IcCandidate],
    *,
    entities: list[Entity],
    run_id: str,
    tolerance: Decimal = Decimal("1.00"),
    mode: MatchMode = MatchMode.AGGREGATE,
) -> MatchResult:
    """
    Pair IC candidates within the same period after conversion.

    Rules:
    - Partner must resolve via alias table (never amount alone).
    - Aggregate per (company pair, period): sum seller vs sum buyer.
    - |difference| ≤ tolerance → MATCHED (eligible for elimination).
    - Both sides present but over tolerance → MISMATCH (VAL-008), not eliminated.
    - Only one side → ONE_SIDED (VAL-007), not eliminated.
    - Each record is allocated to at most one match group.
    """
    eligible = [c for c in candidates if c.ic_eligible]
    buckets: dict[str, list[IcCandidate]] = {}
    unresolved: list[IcCandidate] = []

    for cand in eligible:
        partner_id = _resolve_partner(cand, entities)
        if partner_id is None or partner_id == cand.company_id:
            unresolved.append(cand)
            continue
        key = _pair_key(cand.company_id, partner_id, cand.period)
        buckets.setdefault(key, []).append(cand)

    matches: list[MatchGroup] = []
    findings: list[IcFinding] = []
    used: set[str] = set()

    for key, members in sorted(buckets.items()):
        # Split by which company is "reporting" vs partner using resolved side when possible.
        company_a, company_b, period = key.split("|")
        side_a: list[IcCandidate] = []
        side_b: list[IcCandidate] = []
        for m in members:
            partner_id = _resolve_partner(m, entities)
            if m.company_id == company_a and partner_id == company_b:
                side_a.append(m)
            elif m.company_id == company_b and partner_id == company_a:
                side_b.append(m)
            else:
                # Ambiguous membership — treat as unresolved
                unresolved.append(m)

        if not side_a and not side_b:
            continue

        sum_a = sum((abs(x.amount_group) for x in side_a), Decimal("0"))
        sum_b = sum((abs(x.amount_group) for x in side_b), Decimal("0"))

        if side_a and not side_b:
            status = MatchStatus.ONE_SIDED
            difference = sum_a
            findings.append(
                IcFinding(
                    rule_id="VAL-007",
                    severity="WARNING",
                    record_ids=tuple(x.record_id for x in side_a),
                    reason=f"one-sided IC: {company_a}→{company_b} period={period}",
                    difference=difference,
                )
            )
        elif side_b and not side_a:
            status = MatchStatus.ONE_SIDED
            difference = sum_b
            findings.append(
                IcFinding(
                    rule_id="VAL-007",
                    severity="WARNING",
                    record_ids=tuple(x.record_id for x in side_b),
                    reason=f"one-sided IC: {company_b}→{company_a} period={period}",
                    difference=difference,
                )
            )
        else:
            difference = abs(sum_a - sum_b)
            if difference <= tolerance:
                status = MatchStatus.MATCHED
            else:
                status = MatchStatus.MISMATCH
                findings.append(
                    IcFinding(
                        rule_id="VAL-008",
                        severity="WARNING",
                        record_ids=tuple(x.record_id for x in side_a + side_b),
                        reason=(
                            f"IC amount mismatch {company_a}↔{company_b} "
                            f"period={period}: {sum_a} vs {sum_b}"
                        ),
                        difference=difference,
                    )
                )

        match_members: list[MatchMember] = []
        for x in side_a:
            match_members.append(
                MatchMember(
                    record_id=x.record_id,
                    company_id=x.company_id,
                    side=x.side if x.side != "unknown" else "seller",
                    amount_group=abs(x.amount_group),
                )
            )
            used.add(x.record_id)
        for x in side_b:
            match_members.append(
                MatchMember(
                    record_id=x.record_id,
                    company_id=x.company_id,
                    side=x.side if x.side != "unknown" else "buyer",
                    amount_group=abs(x.amount_group),
                )
            )
            used.add(x.record_id)

        matches.append(
            MatchGroup(
                match_group_id=_match_id(run_id, key),
                run_id=run_id,
                mode=mode,
                status=status,
                members=match_members,
                difference=difference,
                tolerance=tolerance,
            )
        )

    unmatched = [
        c.record_id
        for c in eligible
        if c.record_id not in used
    ]
    # Unresolved partner text also counts as unmatched / not eliminated
    for c in unresolved:
        if c.record_id not in used and c.record_id not in unmatched:
            unmatched.append(c.record_id)
            findings.append(
                IcFinding(
                    rule_id="VAL-007",
                    severity="WARNING",
                    record_ids=(c.record_id,),
                    reason=(
                        f"partner not resolved via aliases: {c.partner_text!r}"
                        if c.partner_text
                        else "missing trading partner"
                    ),
                )
            )

    return MatchResult(matches=matches, findings=findings, unmatched_record_ids=unmatched)


def elimination_amount(match: MatchGroup) -> Decimal:
    """Amount to eliminate: min of the two sides for matched pairs (common practice when equal)."""
    if match.status != MatchStatus.MATCHED:
        raise ValueError("only MATCHED groups have an elimination amount")
    sellers = [m for m in match.members if m.side == "seller"]
    buyers = [m for m in match.members if m.side == "buyer"]
    sum_s = sum((m.amount_group for m in sellers), Decimal("0"))
    sum_b = sum((m.amount_group for m in buyers), Decimal("0"))
    if sellers and buyers:
        return min(sum_s, sum_b)
    return abs(match.members[0].amount_group)
