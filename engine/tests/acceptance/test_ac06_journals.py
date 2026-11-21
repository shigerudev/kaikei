"""AC6 Journals: every journal balances; one journal per matched pair per run; a rerun adds none."""

from __future__ import annotations

from decimal import Decimal

from .conftest import API, start_run


def test_every_journal_balances(reconciliations):
    assert reconciliations["journals"], "no journals produced"
    for journal in reconciliations["journals"]:
        debit = sum((Decimal(line["debit"]) for line in journal["lines"]), Decimal("0"))
        credit = sum((Decimal(line["credit"]) for line in journal["lines"]), Decimal("0"))
        assert debit == credit and debit > 0, f"{journal['id']}: debit {debit} != credit {credit}"


def test_one_journal_per_matched_group(reconciliations):
    matched = [m["id"] for m in reconciliations["matches"] if m["status"] == "MATCHED"]
    journalled = [j["match_group_id"] for j in reconciliations["journals"]]
    assert len(journalled) == len(set(journalled)), "a matched group has more than one journal"
    assert sorted(journalled) == sorted(matched), (
        f"{len(journalled)} journals for {len(matched)} matched groups"
    )


def test_rerun_adds_no_journals_and_leaves_the_first_run_alone(client, baseline, reconciliations):
    before = sorted(j["id"] for j in reconciliations["journals"])
    second = start_run(client)
    again = client.get(f"{API}/consolidations/{second['id']}/reconciliations").json()
    assert len(again["journals"]) == len(before), "rerun produced a different journal count"
    first_again = client.get(f"{API}/consolidations/{baseline['id']}/reconciliations").json()
    assert sorted(j["id"] for j in first_again["journals"]) == before, (
        "first run's journals changed"
    )
