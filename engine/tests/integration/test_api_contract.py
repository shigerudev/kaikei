"""The K6 wire contract the Next.js app reads (MANIFESTO §4.4, `lib/api/types.ts`).

These tests are the reason the dashboard renders: they pin the shapes `lib/api/` expects —
group configuration, the run list, the statement with its subtotals and totals, findings,
files — and the two rules every figure obeys (decimal strings, and a subtotal that really is
the sum of its components).
"""

from __future__ import annotations

import re
from decimal import Decimal

from fastapi.testclient import TestClient

from kaikei.application.chart_of_accounts import BS_LAYOUT, PL_LAYOUT
from kaikei.main import app

client = TestClient(app)

GROUP = "grupo-ag"
# A money field at the reporting scale: four decimals, always, so "0" never reaches the UI.
MONEY = re.compile(r"^-?\d+\.\d{4}$")


def _run() -> dict:
    response = client.post("/api/v1/consolidations", json={"group_id": GROUP})
    assert response.status_code == 201
    return response.json()


def _facts(run_id: str, period: str = "2027", statement: str = "PL") -> dict:
    response = client.get(
        f"/api/v1/consolidations/{run_id}/facts",
        params={"period": period, "statement": statement},
    )
    assert response.status_code == 200
    return response.json()


# ── Group configuration ──────────────────────────────────────────────────────────


def test_group_config_comes_from_the_group_data_files():
    group = client.get(f"/api/v1/groups/{GROUP}")
    assert group.status_code == 200
    assert group.json() == {
        "id": "grupo-ag",
        "name": "Grupo AG",
        "reporting_currency": "USD",
        "scenario": "BUDGET_2027",
    }
    assert client.get("/api/v1/groups/nope").status_code == 404


def test_companies_carry_every_field_the_screens_need():
    companies = client.get(f"/api/v1/groups/{GROUP}/companies").json()
    assert [c["id"] for c in companies] == ["EMP1", "EMP2", "EMP3", "EMP4", "EMP5", "EMP6"]
    emp5 = next(c for c in companies if c["id"] == "EMP5")
    assert emp5["country"] == "ES"
    assert emp5["functional_currency"] == "EUR"
    assert emp5["ownership_pct"] == "100"
    assert emp5["consolidation_method"] == "FULL"
    assert "AG España" in emp5["aliases"]  # the alias table, not a guess
    assert emp5["filename"] == "05_AG_Espana.csv"
    assert emp5["format"]


def test_rate_set_publishes_both_sides_of_the_group_quote():
    rate_set = client.get(f"/api/v1/groups/{GROUP}/fx-rate-sets/current").json()
    assert rate_set["id"] and rate_set["version"]
    average_2027 = next(
        r
        for r in rate_set["rates"]
        if r["from_ccy"] == "GTQ" and r["rate_type"] == "average" and r["period"] == "2027"
    )
    assert average_2027["to_ccy"] == "USD"
    assert average_2027["rate"] == "0.129032"  # USD per 1 GTQ, as translation uses it
    assert average_2027["units_per_usd"] == "7.75"  # the group table's own inverse quote


def test_parameters_are_served_with_their_source():
    parameters = client.get(f"/api/v1/groups/{GROUP}/parameters").json()
    tolerance = next(p for p in parameters if p["parameter"] == "ic_match_tolerance")
    assert (tolerance["value"], tolerance["unit"]) == ("1.00", "USD")
    assert tolerance["source"]


# ── Runs ─────────────────────────────────────────────────────────────────────────


def test_runs_are_listed_newest_first_and_numbered():
    first = _run()
    second = _run()
    runs = client.get("/api/v1/consolidations", params={"group_id": GROUP}).json()
    assert [r["id"] for r in runs] == [second["id"], first["id"]]
    assert [r["number"] for r in runs] == [2, 1]
    assert runs[0]["parent_run_id"] == first["id"]
    assert runs[0]["scenario"] == "BUDGET_2027"
    assert runs[0]["reason"]


def test_run_reports_the_seven_stages_in_order():
    run = _run()
    assert [s["key"] for s in run["stages"]] == [
        "ingest",
        "normalize",
        "validate",
        "translate",
        "match",
        "eliminate",
        "aggregate",
    ]
    for stage in run["stages"]:
        assert stage["label"] and stage["detail"]
        assert stage["status"] in ("done", "warning", "blocked", "pending")
    # The validate stage has warnings to report on this pack and says how many.
    validate = next(s for s in run["stages"] if s["key"] == "validate")
    assert validate["status"] == "warning"
    assert "open findings" in validate["detail"]


def test_run_inputs_are_a_list_of_pinned_files():
    run = _run()
    files = run["inputs"]["files"]
    assert [f["company_id"] for f in files] == ["EMP1", "EMP2"]
    for pinned in files:
        assert len(pinned["sha256"]) == 64
        assert pinned["filename"].endswith(".csv")
    assert run["inputs"]["mapping_version"]
    assert run["inputs"]["rate_set_id"]
    assert run["inputs"]["rule_set_version"]
    assert run["inputs"]["decisions"] == []
    counts = run["counts"]
    assert counts["translated"] + counts["held_back"] == counts["records"]
    assert counts["mismatched"] == 1  # the planted E02 pair


# ── Facts: the statement ─────────────────────────────────────────────────────────


def test_facts_are_a_statement_not_a_bare_list():
    run = _run()
    facts = _facts(run["id"])
    assert facts["run_id"] == run["id"]
    assert facts["period"] == "2027"
    assert facts["statement"] == "PL"
    assert facts["currency"] == "USD"
    assert isinstance(facts["rows"], list)


def test_kpi_rows_the_dashboard_reads_are_present():
    run = _run()
    pl = {r["group_account"]: r for r in _facts(run["id"])["rows"]}
    for code in ("REVENUE", "OPERATING_PROFIT", "NET_PROFIT"):
        assert code in pl, f"the dashboard reads {code} and would show an em-dash without it"
        assert pl[code]["kind"] in ("subtotal", "total")
        assert pl[code]["name"] != code  # a human label, not the code

    bs = {r["group_account"]: r for r in _facts(run["id"], statement="BS")["rows"]}
    for code in ("TOTAL_ASSETS", "TOTAL_LIABILITIES", "EQUITY"):
        assert code in bs


def test_every_subtotal_equals_the_sum_of_its_components():
    run = _run()
    for statement, layout in (("PL", PL_LAYOUT), ("BS", BS_LAYOUT)):
        rows = {r["group_account"]: r for r in _facts(run["id"], statement=statement)["rows"]}
        computed = [line for line in layout if line.kind != "line"]
        assert computed, "a statement with no subtotals would hide the aggregation"
        for line in computed:
            row = rows[line.code]
            for field in ("contributions_total", "adjustments_total", "amount"):
                expected = sum(
                    (
                        (Decimal(1) if sign == "+" else Decimal(-1))
                        * Decimal(rows[component][field] if component in rows else "0")
                        for sign, component in line.components
                    ),
                    Decimal("0"),
                )
                assert Decimal(row[field]) == expected, f"{statement} {line.code}.{field}"


def test_every_row_is_contributions_plus_eliminations_in_decimal_strings():
    run = _run()
    for statement in ("PL", "BS"):
        for row in _facts(run["id"], statement=statement)["rows"]:
            for field in ("contributions_total", "adjustments_total", "amount"):
                assert MONEY.match(row[field]), f"{row['group_account']}.{field}={row[field]!r}"
            for value in row["by_company"].values():
                assert MONEY.match(value)
            assert Decimal(row["amount"]) == Decimal(row["contributions_total"]) + Decimal(
                row["adjustments_total"]
            )


def test_a_company_column_adds_up_to_the_contributions_total():
    run = _run()
    for row in _facts(run["id"])["rows"]:
        if row["blocked_companies"]:
            continue  # an excluded company stays visible per company but out of the total
        total = sum((Decimal(v) for v in row["by_company"].values()), Decimal("0"))
        assert total == Decimal(row["contributions_total"]), row["group_account"]


def test_the_fiscal_year_is_the_sum_of_its_months():
    run = _run()
    year = {r["group_account"]: r for r in _facts(run["id"], period="2027")["rows"]}
    monthly: dict[str, Decimal] = {}
    for month in range(1, 13):
        for row in _facts(run["id"], period=f"2027-{month:02d}")["rows"]:
            monthly[row["group_account"]] = monthly.get(
                row["group_account"], Decimal("0")
            ) + Decimal(row["contributions_total"])
    for code, total in monthly.items():
        assert Decimal(year[code]["contributions_total"]) == total, code


def test_a_balance_sheet_is_always_reported_at_its_closing_period():
    run = _run()
    facts = _facts(run["id"], period="2027-03", statement="BS")
    assert facts["period"] == "2027-12"  # MANIFESTO §4.2: the period of its closing date
    assert all(row["period"] == "2027-12" for row in facts["rows"])


def test_a_posted_line_traces_to_its_lineage_and_a_subtotal_has_none():
    run = _run()
    rows = _facts(run["id"])["rows"]
    line = next(r for r in rows if r["kind"] == "line")
    subtotal = next(r for r in rows if r["kind"] == "subtotal")
    assert client.get(f"/api/v1/facts/{line['id']}/lineage").status_code == 200
    assert client.get(f"/api/v1/facts/{subtotal['id']}/lineage").status_code == 404


def test_facts_reject_an_unknown_statement():
    run = _run()
    response = client.get(
        f"/api/v1/consolidations/{run['id']}/facts", params={"statement": "CASHFLOW"}
    )
    assert response.status_code == 422


# ── Findings ─────────────────────────────────────────────────────────────────────


def test_findings_carry_their_catalog_row_and_located_source_cells():
    run = _run()
    findings = client.get(f"/api/v1/consolidations/{run['id']}/findings").json()
    assert findings
    for finding in findings:
        assert finding["title"] and finding["error_type"] and finding["expected_behavior"]
        assert finding["severity"] in ("BLOCKER", "WARNING", "INFO")
        assert finding["status"] == "OPEN"
        assert finding["decisions"] == []
        assert isinstance(finding["affects_publication"], bool)
        for ref in finding["source_refs"]:
            assert ref["filename"]
            assert ref["file_id"]  # the inspector opens the stored original from this
            assert ref["cell"]


# ── Intercompany ─────────────────────────────────────────────────────────────────


def test_eliminations_land_on_the_accounts_they_reverse():
    run = _run()
    reconciliations = client.get(f"/api/v1/consolidations/{run['id']}/reconciliations").json()
    journals = reconciliations["journals"]
    assert journals
    for journal in journals:
        accounts = {line["group_account"] for line in journal["lines"]}
        assert accounts == {"REV_IC", "COGS_IC"}, "a journal must reverse real group accounts"
        assert journal["flow"] == "Product sales"
        assert journal["period"].startswith("2027-")
        debit = sum(Decimal(line["debit"]) for line in journal["lines"])
        credit = sum(Decimal(line["credit"]) for line in journal["lines"])
        assert debit == credit  # K5: Σ debit = Σ credit
        for line in journal["lines"]:
            assert line["company_id"]  # which company's figure comes down
            assert MONEY.match(line["debit"]) and MONEY.match(line["credit"])

    # ...and the statement shows that reversal on both legs, in equal measure.
    rows = {r["group_account"]: r for r in _facts(run["id"])["rows"]}
    assert Decimal(rows["REV_IC"]["adjustments_total"]) < 0
    assert rows["REV_IC"]["adjustments_total"] == rows["COGS_IC"]["adjustments_total"]


def test_matches_name_the_seller_the_buyer_and_the_flow():
    run = _run()
    matches = client.get(f"/api/v1/consolidations/{run['id']}/reconciliations").json()["matches"]
    assert matches
    for match in matches:
        assert match["status"] in ("MATCHED", "MISMATCH", "ONE_SIDED")
        assert match["mode"] in ("transaction", "aggregate")
        assert match["seller"]["source"]["cell"]
        assert MONEY.match(match["difference"]) and MONEY.match(match["tolerance"])
        if match["status"] == "ONE_SIDED":
            assert match["buyer"] is None
            assert match["journal_id"] is None


# ── Files and mappings ───────────────────────────────────────────────────────────


def test_files_report_one_stored_pack_per_company():
    _run()
    files = client.get("/api/v1/files", params={"group_id": GROUP}).json()
    assert [f["company_id"] for f in files] == ["EMP1", "EMP2", "EMP3", "EMP4", "EMP5", "EMP6"]
    emp1 = files[0]
    assert len(emp1["sha256"]) == 64
    assert emp1["rows"] and emp1["records"]
    assert emp1["status"] == "MAPPING_APPROVED"
    assert emp1["id"] == "FILE-EMP1"


def test_file_preview_shows_what_the_engine_read_and_the_mapping_it_used():
    _run()
    preview = client.get("/api/v1/files/FILE-EMP1/preview").json()
    assert preview["file_id"] == "FILE-EMP1"
    assert preview["rows"]
    row = preview["rows"][0]
    assert row["source"]["filename"] == "01_AG_Distribucion_GT.csv"
    assert row["source"]["raw"]
    assert MONEY.match(row["amount_local"])
    assert row["statement"] in ("PL", "BS")
    mapping = preview["account_mapping"]
    assert mapping
    ic_line = next(m for m in mapping if m["group_account"] == "COGS_IC")
    assert ic_line["partner"] == "EMP2"


def test_approving_a_mapping_freezes_its_version():
    _run()
    response = client.post(f"/api/v1/mappings/{GROUP}:EMP3/approve")
    assert response.status_code == 200
    assert response.json()["status"] == "MAPPING_APPROVED"
    assert response.json()["mapping_version"]
    assert client.post(f"/api/v1/mappings/{GROUP}:NOPE/approve").status_code == 404


def test_uploading_the_same_pack_again_is_recognised_not_reimported():
    _run()
    path = "fixtures/grupo-ag/01_AG_Distribucion_GT.csv"
    from pathlib import Path

    data = (Path(__file__).resolve().parents[3] / path).read_bytes()
    response = client.post(
        "/api/v1/files",
        data={"group_id": GROUP},
        files={"file": ("01_AG_Distribucion_GT.csv", data, "text/csv")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["alreadyImported"] is True
    assert body["file"]["company_id"] == "EMP1"


def test_an_unidentifiable_upload_is_refused_with_a_reason():
    response = client.post(
        "/api/v1/files",
        data={"group_id": GROUP},
        files={"file": ("mystery.csv", b"a,b\n1,2\n", "text/csv")},
    )
    assert response.status_code == 422
    assert "mystery.csv" in response.json()["detail"]


# ── Decisions ────────────────────────────────────────────────────────────────────


def test_a_decision_creates_a_new_run_pinned_to_it():
    run = _run()
    findings = client.get(f"/api/v1/consolidations/{run['id']}/findings").json()
    target = next(f for f in findings if f["rule_id"] == "VAL-008")

    response = client.post(
        f"/api/v1/findings/{target['id']}/decisions",
        json={"action": "ACCEPT_RISK", "reason": "Confirmed with EMP1; correction next cycle."},
        params={"group_id": GROUP},
    )
    assert response.status_code == 201
    next_run = response.json()
    assert next_run["id"] != run["id"]
    assert next_run["number"] == run["number"] + 1
    assert next_run["parent_run_id"] == run["id"]
    assert "correction next cycle" in next_run["reason"]
    # A decision is an input: it is listed, and it changes the fingerprint.
    assert next_run["inputs"]["decisions"] == [f"{target['id']}:ACCEPTED_RISK"]
    assert next_run["fingerprint"] != run["fingerprint"]

    decided = next(
        f
        for f in client.get(f"/api/v1/consolidations/{next_run['id']}/findings").json()
        if f["id"] == target["id"]
    )
    assert decided["status"] == "ACCEPTED_RISK"
    assert decided["affects_publication"] is False
    assert decided["decisions"][0]["resulting_run_id"] == next_run["id"]
    assert decided["decisions"][0]["actor"]
    # The earlier run is untouched: runs are immutable.
    assert (
        run["fingerprint"]
        == client.get(f"/api/v1/consolidations/{run['id']}").json()["fingerprint"]
    )


def test_a_decision_needs_a_reason():
    run = _run()
    findings = client.get(f"/api/v1/consolidations/{run['id']}/findings").json()
    response = client.post(
        f"/api/v1/findings/{findings[0]['id']}/decisions",
        json={"action": "RESOLVE", "reason": ""},
    )
    assert response.status_code == 422


# ── Search ───────────────────────────────────────────────────────────────────────


def test_search_finds_a_company_an_account_and_a_run():
    _run()
    kinds = {
        hit["kind"]
        for term in ("manufactura", "revenue", "run")
        for hit in client.get(f"/api/v1/groups/{GROUP}/search", params={"q": term}).json()
    }
    assert {"company", "account", "run"} <= kinds
    assert client.get(f"/api/v1/groups/{GROUP}/search", params={"q": "a"}).json() == []
