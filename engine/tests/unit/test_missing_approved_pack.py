"""A company with no mapping-approved pack is a finding, not a silent skip."""

from kaikei.application.pipeline import run_consolidation
from kaikei.application.sources import registry


def test_missing_approved_pack_is_parser_010():
    packs = registry("grupo-ag")
    stored = packs.files["EMP3"]
    previous = stored.status
    stored.status = "UPLOADED"
    try:
        record = run_consolidation(group_id="grupo-ag")
        missing = [f for f in record.findings if f.rule_id == "PARSER-010" and "EMP3" in f.reason]
        assert missing, "EMP3 without an approved pack must surface PARSER-010"
        assert all(f.severity.value == "BLOCKER" for f in missing)
        assert "EMP3" not in {company_id for company_id, *_ in record.files}
    finally:
        stored.status = previous
