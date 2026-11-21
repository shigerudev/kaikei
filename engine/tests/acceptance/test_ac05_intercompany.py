"""AC5 Intercompany: every README flow is matched and eliminated, except E02 (mismatch, EMP1 vs
EMP2 March 2027) and E08 (one-sided, EMP6 vs EMP4 December 2027), which are flagged and not
eliminated. Flow list is the one in fixtures/grupo-ag/README.md."""

from __future__ import annotations

from .conftest import answer_key_mapping

MONTHS = [f"2027-{m:02d}" for m in range(1, 13)]
# README "Intercompany flows" table: (seller, buyer) pairs with a monthly P&L flow.
PL_PAIRS = [
    ("EMP2", "EMP1"),  # product sales
    ("EMP2", "EMP3"),  # product sales
    ("EMP6", "EMP1"),  # management fee
    ("EMP6", "EMP3"),
    ("EMP6", "EMP4"),  # management fee + loan interest
    ("EMP6", "EMP5"),
]
# README balances: EMP2 <-> EMP1 AR/AP, EMP6 <-> EMP4 loan.
BS_PAIRS = [("EMP2", "EMP1"), ("EMP6", "EMP4")]
E02 = (frozenset({"EMP1", "EMP2"}), "2027-03")
E08 = (frozenset({"EMP6", "EMP4"}), "2027-12")


def _pair(match: dict) -> frozenset[str]:
    buyer = match.get("buyer")
    return frozenset({match["seller"]["company_id"], buyer["company_id"] if buyer else "?"})


def _is_bs(match: dict) -> bool:
    bs_accounts = {r["group_account"] for r in answer_key_mapping() if r["type"].startswith("BS")}
    return match["seller"]["group_account"] in bs_accounts


def _pl(reconciliations) -> list[dict]:
    return [m for m in reconciliations["matches"] if not _is_bs(m)]


def test_every_monthly_flow_is_matched_every_month(reconciliations):
    problems = []
    for seller, buyer in PL_PAIRS:
        pair = frozenset({seller, buyer})
        for month in MONTHS:
            groups = [m for m in _pl(reconciliations) if _pair(m) == pair and m["period"] == month]
            if (pair, month) in (E02, E08):
                continue
            if not groups or any(g["status"] != "MATCHED" for g in groups):
                problems.append(
                    f"{seller}->{buyer} {month}: {[g['status'] for g in groups] or 'absent'}"
                )
    assert not problems, f"{len(problems)} README flow-months not matched: {problems[:8]}"


def test_balance_flows_are_matched(reconciliations):
    missing = []
    for seller, buyer in BS_PAIRS:
        pair = frozenset({seller, buyer})
        ok = [
            m
            for m in reconciliations["matches"]
            if _is_bs(m) and _pair(m) == pair and m["status"] == "MATCHED"
        ]
        if not ok:
            missing.append(f"{seller}<->{buyer}")
    assert not missing, f"no MATCHED balance-sheet IC group for {missing}"


def test_e02_mismatch_is_flagged_and_not_eliminated(reconciliations, findings):
    groups = [m for m in _pl(reconciliations) if (_pair(m), m["period"]) == E02]
    assert any(g["status"] == "MISMATCH" and g["journal_id"] is None for g in groups), (
        "EMP1/EMP2 2027-03 is not an un-eliminated MISMATCH: "
        f"{[(g['status'], g['journal_id']) for g in groups]}"
    )
    assert any(f["rule_id"] == "VAL-008" for f in findings)


def test_e08_one_sided_is_flagged_and_not_eliminated(reconciliations, findings):
    groups = [m for m in _pl(reconciliations) if (_pair(m), m["period"]) == E08]
    flagged = [g for g in groups if g["status"] in ("ONE_SIDED", "MISMATCH")]
    assert flagged and all(g["journal_id"] is None for g in flagged), (
        "EMP6/EMP4 2027-12 fee not an un-eliminated flagged group: "
        f"{[(g['status'], g['journal_id']) for g in groups]}"
    )
    assert any(f["rule_id"] == "VAL-007" for f in findings)


def test_nothing_else_is_unmatched(reconciliations):
    """Anything not MATCHED outside E02/E08 is a false flag (or a flow the engine cannot see)."""
    extra = [
        f"{sorted(_pair(m))} {m['period']} {m['status']}"
        for m in reconciliations["matches"]
        if m["status"] != "MATCHED" and (_pair(m), m["period"]) not in (E02, E08)
    ]
    assert not extra, f"{len(extra)} unmatched IC groups outside E02/E08: {extra[:10]}"


def test_every_matched_group_is_eliminated_and_no_other(reconciliations):
    journal_ids = {j["id"] for j in reconciliations["journals"]}
    for m in reconciliations["matches"]:
        if m["status"] == "MATCHED":
            assert m["journal_id"] in journal_ids, f"matched group {m['id']} has no journal"
        else:
            assert m["journal_id"] is None, f"{m['status']} group {m['id']} was eliminated"
