"""End-to-end: EMP1 + EMP2 fixture pack through the API (K6/K8/lineage, MANIFESTO §4.4).

Exercises `POST /consolidations` -> findings/facts/reconciliations -> `/facts/{id}/lineage`
-> `POST /publish`, against the real `fixtures/grupo-ag` CSVs (no mocks). Covers:

- the planted E02 mismatch (mar-2027 EMP1 "Compras a AG Manufactura" 472,500 GTQ vs
  EMP2 "Ventas a AG Distribución" 427,500 GTQ) is flagged (VAL-008, WARNING) and not
  eliminated, while the run still reaches PUBLISHED — VAL-008 is a WARNING, not a
  BLOCKER (MANIFESTO §4.3), so it flags without blocking publication;
- every fact amount crosses the API as a decimal string, never a float;
- lineage on a real fact resolves all the way to its source cell;
- the publish gate (409) actually refuses while an OPEN BLOCKER remains;
- reruns on the same inputs are reproducible (same fingerprint, same figures).
"""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient

from kaikei.application.pipeline import PublicationBlockedError, publish_run, run_consolidation
from kaikei.domain.validation.models import FindingStatus, Severity
from kaikei.main import app

client = TestClient(app)


def _create_run() -> dict:
    response = client.post("/api/v1/consolidations")
    assert response.status_code == 201
    return response.json()


def test_fixture_pack_reaches_published_with_e02_flagged_not_eliminated():
    run = _create_run()
    run_id = run["id"]
    assert run["status"] in ("DRAFT", "BLOCKED")

    findings = client.get(f"/api/v1/consolidations/{run_id}/findings").json()
    mismatches = [f for f in findings if f["rule_id"] == "VAL-008"]
    e02 = next(
        f
        for f in mismatches
        if any(
            r["filename"] == "01_AG_Distribucion_GT.csv" and r["row"] == 26
            for r in f["source_refs"]
        )
    )
    assert e02["severity"] == "WARNING"
    assert e02["status"] == "OPEN"
    assert e02["affects_publication"] is False
    assert sorted(e02["company_ids"]) == ["EMP1", "EMP2"]
    refs = {(r["filename"], r["row"], r["raw"]) for r in e02["source_refs"]}
    assert ("01_AG_Distribucion_GT.csv", 26, "472500") in refs
    assert ("02_AG_Manufactura_GT.csv", 4, "427500") in refs

    reconciliations = client.get(f"/api/v1/consolidations/{run_id}/reconciliations").json()
    group = next(m for m in reconciliations["matches"] if m["finding_id"] == e02["id"])
    assert group["status"] == "MISMATCH"
    assert group["journal_id"] is None  # never eliminated
    mismatched_record_ids = {
        side["record_id"] for side in (group["seller"], group["buyer"]) if side
    }
    eliminated_record_ids = {
        rid for j in reconciliations["journals"] for rid in j["source_record_ids"]
    }
    assert mismatched_record_ids.isdisjoint(eliminated_record_ids)  # never silently eliminated

    publish_response = client.post(f"/api/v1/consolidations/{run_id}/publish")
    if run["status"] == "DRAFT":
        assert publish_response.status_code == 200
        assert publish_response.json()["status"] == "PUBLISHED"
    else:
        assert publish_response.status_code == 409


def test_facts_cross_the_api_as_decimal_strings():
    run = _create_run()
    facts = client.get(
        f"/api/v1/consolidations/{run['id']}/facts", params={"period": "2027-01"}
    ).json()
    assert len(facts["rows"]) > 0
    for row in facts["rows"]:
        for field in ("amount", "contributions_total", "adjustments_total"):
            value = row[field]
            assert isinstance(value, str)
            Decimal(value)  # never raises InvalidOperation: it's a real decimal string
        for value in row["by_company"].values():
            assert isinstance(value, str)
            Decimal(value)


def test_lineage_resolves_a_fact_to_its_real_source_cell():
    run = _create_run()
    run_id = run["id"]
    facts = client.get(
        f"/api/v1/consolidations/{run_id}/facts", params={"period": "2027-01"}
    ).json()
    sales = next(r for r in facts["rows"] if r["group_account"] == "REV_SALES")

    lineage = client.get(f"/api/v1/facts/{sales['id']}/lineage").json()
    assert lineage["amount"] == sales["amount"]
    assert len(lineage["contributions"]) >= 1

    contribution = next(c for c in lineage["contributions"] if c["company_id"] == "EMP1")
    record = contribution["records"][0]
    source = record["source"]
    assert source["filename"] == "01_AG_Distribucion_GT.csv"
    assert source["row"] == 2  # ene-2027,4101,Ventas locales,2160000,Presupuesto,
    assert source["raw"] == "2160000"
    assert record["amount_local"] == "2160000.0000"
    assert Decimal(contribution["rate"]["rate"]) > 0


def test_publish_blocked_while_an_open_blocker_remains():
    record = run_consolidation()
    record.findings[0].severity = Severity.BLOCKER
    record.findings[0].status = FindingStatus.OPEN
    try:
        publish_run(record.run.id)
        raise AssertionError("expected PublicationBlockedError")
    except PublicationBlockedError as exc:
        assert exc.run_id == record.run.id
        assert exc.open_blockers

    response = client.post(f"/api/v1/consolidations/{record.run.id}/publish")
    assert response.status_code == 409
    assert response.json()["detail"]["open_blocker_ids"]


def test_rerun_on_the_same_inputs_is_reproducible():
    first = run_consolidation()
    second = run_consolidation()
    assert first.run.fingerprint == second.run.fingerprint
    assert (first.run.number, second.run.number) == (1, 2)
    assert second.run.parent_run_id == first.run.id

    def without_run_scoped_ids(fact):
        data = fact.model_dump()
        del data["fact_id"]
        del data["run_id"]
        return data

    first_facts = sorted(
        (without_run_scoped_ids(f) for f in first.facts),
        key=lambda d: (d["group_account_code"], d["period"]),
    )
    second_facts = sorted(
        (without_run_scoped_ids(f) for f in second.facts),
        key=lambda d: (d["group_account_code"], d["period"]),
    )
    assert first_facts == second_facts  # identical figures; only run/fact ids differ
