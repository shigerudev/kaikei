"""AC2 Mapping: every local account maps as answer_key_mapping.csv; 9.9.99 (E07) is a finding."""

from __future__ import annotations

from .conftest import answer_key_mapping


def _key() -> dict[tuple[str, str], str]:
    return {
        (r["entity"], r["local_account"].strip()): r["group_account"] for r in answer_key_mapping()
    }


def _mapped(lineages) -> dict[tuple[str, str], set[str]]:
    seen: dict[tuple[str, str], set[str]] = {}
    for row, lin in lineages:
        for contribution in lin["contributions"]:
            for rec in contribution["records"]:
                key = (contribution["company_id"], rec["local_account"].strip())
                seen.setdefault(key, set()).add(row["group_account"])
    return seen


def test_no_record_maps_to_a_different_group_account_than_the_key(lineages):
    key = _key()
    wrong = [
        f"{k}: engine {sorted(v)} vs key {key[k]}"
        for k, v in _mapped(lineages).items()
        if k in key and v != {key[k]}
    ]
    assert not wrong, f"{len(wrong)} accounts mapped differently from the key: {wrong[:8]}"


def test_every_key_account_is_mapped_by_the_engine(lineages):
    """Coverage: each local account in the key reaches a consolidated fact."""
    key = _key()
    mapped = set(_mapped(lineages))
    missing = sorted(k for k in key if k not in mapped)
    assert not missing, (
        f"{len(missing)} of {len(key)} key accounts never reach a consolidated fact; "
        f"companies affected: {sorted({m[0] for m in missing})}"
    )


def test_account_9_9_99_is_a_finding_not_a_dropped_row(findings):
    assert ("EMP4", "9.9.99") not in _key(), "9.9.99 must stay unmapped in the key"
    hits = [
        f
        for f in findings
        if f["rule_id"] == "VAL-003"
        and any(
            r["filename"] == "04_AG_Panama.csv" and r.get("row") == 101 for r in f["source_refs"]
        )
    ]
    assert hits, "no VAL-003 finding at 04_AG_Panama.csv line 101 (9.9.99 dropped or unflagged)"
