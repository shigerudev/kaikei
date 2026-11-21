"""AC10 Reproducibility: same inputs and versions -> same fingerprint and identical facts."""

from __future__ import annotations

import json

from .conftest import API, start_run, statement_rows, strip_run_id


def _snapshot(client, run: dict) -> dict:
    rid = run["id"]
    snap = {
        "pl_fy": statement_rows(client, rid, "2027", "PL"),
        "bs": statement_rows(client, rid, None, "BS"),
        "findings": sorted(
            (f["id"], f["rule_id"], f["severity"])
            for f in client.get(f"{API}/consolidations/{rid}/findings").json()
        ),
        # Match/journal ids are derived per run; compare their content, not their names.
        "journals": sorted(
            json.dumps(
                {
                    k: v
                    for k, v in strip_run_id(j, rid).items()
                    if k not in ("id", "match_group_id")
                },
                sort_keys=True,
            )
            for j in client.get(f"{API}/consolidations/{rid}/reconciliations").json()["journals"]
        ),
    }
    return strip_run_id(snap, rid)


def test_two_runs_on_the_same_inputs_share_fingerprint_and_facts(client):
    a, b = start_run(client), start_run(client)
    assert a["id"] != b["id"], "a rerun must be a distinct run"
    assert a["fingerprint"] == b["fingerprint"], "same inputs gave different fingerprints"
    assert a["inputs"] == b["inputs"]
    snap_a, snap_b = _snapshot(client, a), _snapshot(client, b)
    assert json.dumps(snap_a, sort_keys=True) == json.dumps(snap_b, sort_keys=True)
