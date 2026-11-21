"""AC7 Consolidated figures: facts equal golden.json; each fact = sum contributions + sum
adjustments. Expected numbers are never computed from engine output."""

from __future__ import annotations

import json
from decimal import Decimal

import pytest

from .conftest import FIX, statement_rows


def test_each_fact_is_contributions_plus_adjustments(lineages):
    """amount = contributions_total + adjustments_total (signed), and both totals are the sums of
    the lineage's own lines (adjustment lines are journal magnitudes; the row carries the sign)."""
    assert lineages, "no facts"
    bad = []
    for row, lin in lineages:
        contrib = sum((Decimal(c["amount_group"]) for c in lin["contributions"]), Decimal("0"))
        adj = sum((Decimal(a["amount_group"]) for a in lin["adjustments"]), Decimal("0"))
        adjustments_total = Decimal(row["adjustments_total"])
        if not (
            Decimal(row["contributions_total"]) == contrib
            and abs(adjustments_total) == adj
            and Decimal(row["amount"]) == contrib + adjustments_total
        ):
            bad.append(
                f"{row['group_account']}: {row['amount']} vs {contrib} + {adjustments_total}"
            )
    assert not bad, f"{len(bad)} facts are not the sum of their parts: {bad[:5]}"


@pytest.mark.xfail(
    strict=True,
    reason="fixtures/grupo-ag/golden.json not yet authored (owner: Jordi); "
    "fixtures/golden.json is the unrelated Panaderia La Ceiba seed",
)
def test_facts_equal_golden_numbers(client, baseline):
    """Assumed golden schema: {"facts": [{"statement","period","group_account","amount"}]}.
    Revisit the schema when Jordi authors the file."""
    golden_path = FIX / "golden.json"
    assert golden_path.exists(), "golden.json not authored"
    golden = json.loads(golden_path.read_text(encoding="utf-8"))
    mismatches = []
    for want in golden["facts"]:
        rows = statement_rows(client, baseline["id"], want["period"], want["statement"])
        got = next((r for r in rows if r["group_account"] == want["group_account"]), None)
        if got is None or Decimal(got["amount"]) != Decimal(want["amount"]):
            mismatches.append((want, got and got["amount"]))
    assert not mismatches, f"{len(mismatches)} facts differ from golden: {mismatches[:5]}"
