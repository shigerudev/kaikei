"""AC4 FX: group rate per statement and scenario; local rates ignored and reported; a removed
rate is a BLOCKER and nothing is translated for that scope."""

from __future__ import annotations

import csv
from decimal import ROUND_HALF_EVEN, Decimal

from kaikei.domain.fx import CanonicalAmount, load_rate_set, translate_records

from .conftest import FIX, entity_currencies, group_rates


def test_every_company_currency_is_translated(lineages):
    seen = {c["company_id"]: c["currency"] for _r, lin in lineages for c in lin["contributions"]}
    assert seen == entity_currencies(), f"translated {seen}, expected {entity_currencies()}"


def test_each_translated_record_uses_the_group_rate_for_its_statement(lineages):
    rates = group_rates()
    checked, bad = 0, []
    for row, lin in lineages:
        rate_type, period = (
            ("average", "2027") if row["statement"] == "PL" else ("closing", "2027-12-31")
        )
        for c in lin["contributions"]:
            if c["currency"] == "USD":
                continue
            expected = rates[(c["currency"], rate_type, period)]
            checked += 1
            rate = c.get("rate") or {}
            got = (rate.get("rate_type"), rate.get("period"), Decimal(rate.get("rate", "0")))
            if got != (rate_type, period, expected):
                bad.append((row["group_account"], c["company_id"], rate))
                continue
            for rec in c["records"]:
                want = (Decimal(rec["amount_local"]) * expected).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_EVEN
                )
                if abs(Decimal(rec["amount_group"]) - want) > Decimal("0.0001"):
                    bad.append((rec["id"], rec["amount_group"], str(want)))
    assert checked > 0, "no non-USD contributions to check"
    assert not bad, f"{len(bad)} translation mismatches vs tasas_grupo.csv: {bad[:5]}"


def test_local_fx_assumptions_are_reported_not_used(findings):
    conflicts = [f for f in findings if f["rule_id"] == "VAL-024"]
    assert len(conflicts) == 3, f"expected 3 local-rate conflicts (E11a-c), got {len(conflicts)}"
    assert all(f["severity"] == "INFO" for f in conflicts)


def test_missing_group_rate_is_a_blocker_and_translates_nothing(tmp_path):
    """Domain-level: the run API cannot swap the rate table, so this exercises K5 directly."""
    with (FIX / "tasas_grupo.csv").open(encoding="utf-8") as fh:
        rows = [
            r
            for r in csv.DictReader(fh)
            if not (
                r["currency"] == "GTQ" and r["rate_type"] == "average" and r["period"] == "2027"
            )
        ]
    path = tmp_path / "tasas_sin_gtq.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    result = translate_records(
        [CanonicalAmount("r1", "EMP1", "GTQ", Decimal("1000"), "PL", "2027", "2027-01")],
        rate_set=load_rate_set(path),
        run_id="ac4",
    )
    assert result.translated == []
    assert [(f.rule_id, f.severity) for f in result.findings] == [("VAL-004", "BLOCKER")]
