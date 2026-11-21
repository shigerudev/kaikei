"""AC1 Ingest: six packs load; every canonical record opens its raw source cell; SHA-256 of stored
originals matches the bytes; re-uploading the same bytes is a repeat (SCOPE section 5.2)."""

from __future__ import annotations

import pytest

from .conftest import API, FIX, GROUP_ID, entity_files, sha256_of, source_cell

COMPANIES = sorted(entity_files())


def test_all_six_packs_are_ingested(baseline):
    ingested = {f["company_id"] for f in baseline["inputs"]["files"]}
    assert ingested == set(COMPANIES), f"ingested {sorted(ingested)}, expected {COMPANIES}"


def test_stored_sha256_matches_file_bytes(baseline):
    by_company = {f["company_id"]: f for f in baseline["inputs"]["files"]}
    for company, filename in entity_files().items():
        stored = by_company.get(company)
        assert stored is not None, f"{company} ({filename}) not in run inputs"
        assert stored["filename"] == filename
        assert stored["sha256"] == sha256_of(FIX / filename), f"{filename}: SHA-256 differs"


def test_every_company_yields_canonical_records(lineages):
    seen = {c["company_id"] for _row, lin in lineages for c in lin["contributions"]}
    assert seen == set(COMPANIES), f"canonical records only for {sorted(seen)}"


def test_every_record_source_cell_opens_the_raw_value(lineages):
    """Each canonical record's source ref must point at a real cell holding its raw value."""
    checked = 0
    bad: list[str] = []
    for _row, lin in lineages:
        for contribution in lin["contributions"]:
            for rec in contribution["records"]:
                src = rec["source"]
                checked += 1
                cell = source_cell(src["filename"], src["row"], src["column"])
                if cell is None or src.get("raw") is None or cell.strip() != src["raw"].strip():
                    bad.append(
                        f"{src['filename']}:{src['row']}:{src['column']} "
                        f"file={cell!r} api={src.get('raw')!r}"
                    )
    assert checked > 0, "no canonical records with source cells were found"
    assert not bad, f"{len(bad)} of {checked} source cells do not open their raw value: {bad[:5]}"


@pytest.mark.parametrize("company", COMPANIES)
def test_reupload_same_bytes_is_a_repeat(client, company):
    filename = entity_files()[company]
    data = (FIX / filename).read_bytes()
    resp = client.post(
        f"{API}/files",
        data={"group_id": GROUP_ID},
        files={"file": (filename, data, "text/csv")},
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    flag = body.get("alreadyImported", body.get("already_imported"))
    assert flag is True, f"re-upload of {filename} not detected as a repeat: {body}"
