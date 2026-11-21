"""AC9 Publication gate: with E10 (VAL-023 BLOCKER) open the run cannot publish. After recorded
decisions, a NEW run publishes and the old run is unchanged."""

from __future__ import annotations

import pytest

from .conftest import API, GROUP_ID, start_run

OPEN = ("OPEN", "UNDER_REVIEW")


@pytest.fixture(autouse=True)
def _reset_decisions():
    """Decisions live in module state of the application layer; do not leak them to other ACs."""
    yield
    try:
        from kaikei.application import pipeline

        pipeline.DECISIONS.clear()
    except Exception:  # noqa: BLE001  (state shape may change under the owner's feet)
        pass


def _open_blockers(client, run_id: str) -> list[dict]:
    found = client.get(f"{API}/consolidations/{run_id}/findings").json()
    return [f for f in found if f["severity"] == "BLOCKER" and f["status"] in OPEN]


def test_open_e10_blocks_publication_then_decisions_unlock_a_new_run(client):
    run = start_run(client)
    blockers = _open_blockers(client, run["id"])
    e10 = [
        f
        for f in blockers
        if f["rule_id"] == "VAL-023"
        and any(r["filename"] == "05_AG_Espana.csv" for r in f["source_refs"])
    ]
    assert e10, "E10 (VAL-023 on 05_AG_Espana.csv) is not an open BLOCKER in the run"

    refused = client.post(f"{API}/consolidations/{run['id']}/publish")
    assert refused.status_code == 409, f"publish with open BLOCKER returned {refused.status_code}"
    assert client.get(f"{API}/consolidations/{run['id']}").json()["status"] != "PUBLISHED"

    # Record a decision for every open BLOCKER (each one starts a new run).
    current, original_fingerprint = run, run["fingerprint"]
    for _ in range(20):
        pending = _open_blockers(client, current["id"])
        if not pending:
            break
        resp = client.post(
            f"{API}/findings/{pending[0]['id']}/decisions",
            params={"group_id": GROUP_ID},
            json={"action": "ACCEPT_RISK", "reason": "AC9 acceptance decision", "actor": "ac9"},
        )
        assert resp.status_code == 201, resp.text
        current = resp.json()
    assert not _open_blockers(client, current["id"]), "blockers remain after decisions"
    assert current["id"] != run["id"], "a decision must create a new run"

    published = client.post(f"{API}/consolidations/{current['id']}/publish")
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "PUBLISHED"

    old = client.get(f"{API}/consolidations/{run['id']}").json()
    assert old["status"] != "PUBLISHED" and old["fingerprint"] == original_fingerprint
