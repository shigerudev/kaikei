"""AC3 Validation: exactly the 13 findings of answer_key_errors.csv, each at its file and line,
and no others. The expectation list is parsed from the key at test time."""

from __future__ import annotations

import pytest

from .conftest import finding_matches, parse_answer_key

EXPECTED = parse_answer_key()


def test_answer_key_has_thirteen_entries():
    assert len(EXPECTED) == 13


def test_exactly_thirteen_findings(findings):
    assert len(findings) == 13, f"engine produced {len(findings)} findings, expected exactly 13"


@pytest.mark.parametrize("exp", EXPECTED, ids=[e.id for e in EXPECTED])
def test_planted_error_found_at_its_location(findings, exp):
    hits = [f for f in findings if finding_matches(f, exp)]
    assert hits, (
        f"{exp.id} ({exp.error_type}) not found at {exp.file} lines={sorted(exp.lines or [])}"
    )


def test_no_unplanted_findings(findings):
    extra = [
        f"{f['rule_id']} {[(r['filename'], r.get('row')) for r in f['source_refs']][:2]}"
        for f in findings
        if not any(finding_matches(f, exp) for exp in EXPECTED)
    ]
    assert not extra, f"{len(extra)} findings match no planted error: {extra[:10]}"
