"""AC8 Inspector (partial): for consolidated sales in Jan 2027, contributions + adjustments sum to
the figure and each contribution opens its source cell. Covers REV_SALES only."""

from __future__ import annotations

from decimal import Decimal

from .conftest import API, answer_key_mapping, source_cell, statement_rows


def test_revenue_jan_2027_inspector_sums_and_opens_cells(client, baseline):
    rows = statement_rows(client, baseline["id"], "2027-01", "PL")
    fact = next(r for r in rows if r["group_account"] == "REV_SALES")
    lin = client.get(f"{API}/facts/{fact['id']}/lineage").json()
    contrib = sum((Decimal(c["amount_group"]) for c in lin["contributions"]), Decimal("0"))
    adj = sum((Decimal(a["amount_group"]) for a in lin["adjustments"]), Decimal("0"))
    assert contrib == Decimal(lin["contributions_total"])
    assert abs(Decimal(lin["adjustments_total"])) == adj
    assert contrib + Decimal(lin["adjustments_total"]) == Decimal(lin["amount"])
    companies = {c["company_id"] for c in lin["contributions"]}
    expected = {r["entity"] for r in answer_key_mapping() if r["group_account"] == "REV_SALES"}
    assert companies == expected, (
        f"sales contributions from {sorted(companies)}, key {sorted(expected)}"
    )
    for c in lin["contributions"]:
        for rec in c["records"]:
            src = rec["source"]
            assert source_cell(src["filename"], src["row"], src["column"]) == src["raw"]
