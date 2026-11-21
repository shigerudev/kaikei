"""AC12 Untrusted input: a wrong file type, an oversized file, or an XLSX with formulas is
rejected or flagged. Nothing is executed (we never evaluate a formula; the cached/raw text only).

Uploads go to POST /api/v1/files. A rejection is a 4xx or a stored file with status REJECTED /
parse warnings; silent acceptance as a normal pack is a failure."""

from __future__ import annotations

import io
import zipfile

import pytest

from .conftest import API, FIX, GROUP_ID, entity_files

PACK = entity_files()["EMP1"]


@pytest.fixture(autouse=True)
def _reset_registry():
    """Uploads mutate the stored-originals registry; do not leak into other ACs."""
    yield
    try:
        from kaikei.application import sources

        sources._REGISTRY.clear()
    except Exception:  # noqa: BLE001
        pass


def _upload(client, name: str, data: bytes, ctype: str):
    return client.post(
        f"{API}/files", data={"group_id": GROUP_ID}, files={"file": (name, data, ctype)}
    )


def _rejected_or_flagged(resp) -> bool:
    if 400 <= resp.status_code < 500:
        return True
    if resp.status_code in (200, 201):
        file = resp.json().get("file", {})
        return file.get("status") == "REJECTED" or bool(file.get("parse_warnings"))
    return False


def _xlsx_with_formula() -> bytes:
    sheet = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
        '<row r="1"><c r="A1" t="str"><f>HYPERLINK("http://example.invalid/x","x")</f>'
        "<v>cached</v></c></row></sheetData></worksheet>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.'
            'openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            "</Types>",
        )
        z.writestr("xl/workbook.xml", "<workbook/>")
        z.writestr("xl/worksheets/sheet1.xml", sheet)
    return buf.getvalue()


def test_wrong_file_type_is_rejected(client):
    resp = _upload(
        client, "payload.exe", b"MZ\x90\x00 not a spreadsheet", "application/x-msdownload"
    )
    assert _rejected_or_flagged(resp), f"wrong type accepted: {resp.status_code} {resp.text[:200]}"


def test_binary_content_posing_as_the_expected_csv_is_rejected(client):
    """Name and extension say CSV; the bytes are a PNG header. Content must be checked."""
    resp = _upload(client, PACK, b"\x89PNG\r\n\x1a\n" + b"\x00" * 64, "text/csv")
    assert _rejected_or_flagged(resp), f"binary posing as CSV accepted: {resp.status_code}"


def test_oversized_file_is_rejected(client):
    resp = _upload(client, PACK, b"a,b\n" + b"1,2\n" * (6 * 1024 * 1024), "text/csv")  # ~24 MB
    assert _rejected_or_flagged(resp), f"oversized file accepted: {resp.status_code}"


def test_xlsx_with_formula_is_rejected_or_flagged(client):
    resp = _upload(
        client,
        "01_AG_Distribucion_GT.xlsx",
        _xlsx_with_formula(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    assert _rejected_or_flagged(resp), (
        f"formula XLSX accepted: {resp.status_code} {resp.text[:200]}"
    )
    assert "example.invalid" not in resp.text, "formula target leaked into a response"


def test_untouched_pack_is_still_accepted_as_a_repeat(client):
    """Guard against over-rejection: the genuine pack is not refused by the checks above."""
    resp = _upload(client, PACK, (FIX / PACK).read_bytes(), "text/csv")
    assert resp.status_code in (200, 201), resp.text
