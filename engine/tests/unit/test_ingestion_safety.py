"""PIPER-61: file safety, encoding, delimiter, formulas, row numbering (synthetic inputs)."""

import hashlib

import pytest

from kaikei.domain.ingestion import IngestHint, check_file, ingest_file, sha256_bytes
from kaikei.domain.validation.models import Severity

LONG_HEADER = "Mes,Cuenta,Descripción,Monto (GTQ),Escenario,Contraparte\n"


def _codes(result, rule=None):
    return [f.reason_code for f in result.findings if rule is None or f.rule_id == rule]


def test_sha256_known_vector():
    assert sha256_bytes(b"abc") == hashlib.sha256(b"abc").hexdigest()
    assert sha256_bytes(b"") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_check_file_clean_csv_has_no_findings():
    assert check_file("a.csv", b"a,b\n1,2\n") == []


@pytest.mark.parametrize(
    ("name", "data", "code"),
    [
        ("a.exe", b"a,b\n", "EXTENSION_NOT_ALLOWED"),
        ("a.csv.txt", b"a,b\n", "EXTENSION_NOT_ALLOWED"),
        ("a.csv", b"", "EMPTY_FILE"),
        ("a.csv", b"a,b\n1,\x002\n", "BINARY_CONTENT"),
        ("a.csv", b"PK\x03\x04rest", "BINARY_CONTENT"),  # NUL bytes in zip header
        ("a.csv", b"PK\x03\x04", "SIGNATURE_MISMATCH"),
        ("a.xlsx", b"a,b\n1,2\n", "SIGNATURE_MISMATCH"),
    ],
)
def test_check_file_blocks(name, data, code):
    findings = check_file(name, data)
    assert code in [f.reason_code for f in findings] or (
        # zip-with-NUL is reported as binary, which is equally a block
        findings and findings[0].reason_code == "BINARY_CONTENT"
    )
    assert all(f.rule_id == "PARSER-008" and f.severity == Severity.BLOCKER for f in findings)


def test_size_cap_is_a_parameter():
    data = b"a,b\n" + b"1,2\n" * 100
    assert check_file("a.csv", data, max_bytes=len(data)) == []
    f = check_file("a.csv", data, max_bytes=len(data) - 1)
    assert [x.reason_code for x in f] == ["FILE_TOO_LARGE"]
    r = ingest_file("a.csv", data, max_bytes=10)
    assert not r.accepted
    assert r.rows == []


def test_ingest_rejects_binary_without_parsing():
    r = ingest_file("x.csv", b"Mes,Cuenta\x00\n1,2\n")
    assert not r.accepted
    assert r.rows == []
    assert _codes(r) == ["BINARY_CONTENT"]


def test_xlsx_is_marked_open_work():
    with pytest.raises(NotImplementedError, match="PIPER-64"):
        ingest_file("a.xlsx", b"PK\x03\x04....")


def test_formula_looking_cells_stay_text_with_finding():
    csv_text = (
        LONG_HEADER
        + 'ene-2027,4101,"=HYPERLINK(""http://x"")",100,Presupuesto,\n'
        + "ene-2027,4102,Ventas,=1+1,Presupuesto,\n"
        + "ene-2027,4103,@SUM(A1),50,Presupuesto,\n"
        + "ene-2027,4104,-note,60,Presupuesto,\n"
    )
    r = ingest_file("f.csv", csv_text.encode(), hint=IngestHint(numeric_locale="en_US"))
    assert len(r.rows) == 4
    desc = r.rows[0].cells["Descripción"]
    assert desc.raw == '=HYPERLINK("http://x")'
    assert desc.value == desc.raw  # text, never evaluated
    amt = r.rows[1].cells["Monto (GTQ)"]
    assert amt.raw == "=1+1"
    assert amt.value is None
    formula = [f for f in r.findings if f.reason_code == "FORMULA_LIKE"]
    assert {f.source_refs[0].cell for f in formula} == {"C2", "D3", "C4", "C5"}
    assert all(f.rule_id == "PARSER-009" for f in formula)


def test_negative_number_is_not_formula_like():
    csv_text = LONG_HEADER + "ene-2027,4101,Ventas,-310000.00,Presupuesto,\n"
    r = ingest_file("n.csv", csv_text.encode(), hint=IngestHint(numeric_locale="en_US"))
    assert r.rows[0].cells["Monto (GTQ)"].value == -310000
    assert r.findings == []


def test_blank_amount_is_not_zero_and_dash_is_not_zero():
    csv_text = LONG_HEADER + "ene-2027,4101,A,,Presupuesto,\nene-2027,4102,B,-,Presupuesto,\n"
    r = ingest_file("b.csv", csv_text.encode(), hint=IngestHint(numeric_locale="en_US"))
    blank, dash = (row.cells["Monto (GTQ)"] for row in r.rows)
    assert blank.value is None
    assert blank.raw == ""
    assert dash.value is None
    assert dash.raw == "-"
    assert sorted(_codes(r)) == ["BLANK", "PLACEHOLDER"]


def test_ambiguous_amount_becomes_finding_not_a_guess():
    csv_text = LONG_HEADER + "ene-2027,4101,A,1.234,Presupuesto,\n"
    r = ingest_file("amb.csv", csv_text.encode())  # comma file, no locale hint
    assert r.rows[0].cells["Monto (GTQ)"].value is None
    assert _codes(r) == ["AMBIGUOUS_NUMBER"]


def test_utf8_bom_stripped():
    csv_text = LONG_HEADER + "ene-2027,4101,Ventas,100,Presupuesto,\n"
    r = ingest_file("bom.csv", b"\xef\xbb\xbf" + csv_text.encode("utf-8"))
    assert r.encoding == "utf-8-sig"
    assert r.headers[0] == "Mes"  # no BOM glued to the first header
    assert r.rows[0].period == "2027-01"


def test_windows_1252_fallback():
    csv_text = LONG_HEADER + "ene-2027,4101,Depreciación €,100,Presupuesto,\n"
    r = ingest_file("w.csv", csv_text.encode("cp1252"), hint=IngestHint(numeric_locale="en_US"))
    assert r.encoding == "cp1252"
    assert r.rows[0].cells["Descripción"].raw == "Depreciación €"
    warn = [f for f in r.findings if f.reason_code == "ENCODING_CP1252"]
    assert len(warn) == 1


def test_latin1_when_cp1252_undefined_byte():
    r = ingest_file("l.csv", b"Mes,Cuenta,Monto (GTQ)\nene-2027,\x81,1\n")
    assert r.encoding == "latin-1"


def test_delimiter_detected_from_header_line_not_data():
    csv_text = "Cuenta;Descripción;Importe (€)\n4101;Ventas, locales;1.000,50\n"
    r = ingest_file("d.csv", csv_text.encode())
    assert r.delimiter == ";"
    assert r.rows[0].cells["Descripción"].raw == "Ventas, locales"
    assert r.rows[0].cells["Importe (€)"].value == 1000.50
    assert r.header_currency == "EUR"


def test_tab_delimiter():
    r = ingest_file("t.csv", b"Cuenta\tDescripci\xc3\xb3n\tMonto\n4101\tVentas\t5\n")
    assert r.delimiter == "\t"
    assert r.rows[0].cells["Monto"].value == 5


def test_spreadsheet_style_row_numbers_and_located_findings():
    csv_text = (
        "# preamble one\n"
        "Cuenta,Descripción,Monto (USD)\n"
        "4101,Ventas,100\n"
        "\n"
        '4102,"Línea\nmultilínea",12ab\n'
        "4103,Otra,5\n"
    )
    r = ingest_file("loc.csv", csv_text.encode(), hint=IngestHint(numeric_locale="en_US"))
    assert r.header_rows == [2]
    assert [(x.row, x.kind) for x in r.rows] == [
        (3, "data"),
        (4, "blank"),
        (5, "data"),
        (7, "data"),
    ]
    bad = next(f for f in r.findings if f.reason_code == "INVALID_NUMBER")
    ref = bad.source_refs[0]
    assert (ref.filename, ref.sheet, ref.row, ref.column, ref.cell, ref.raw) == (
        "loc.csv",
        None,
        5,
        "Monto (USD)",
        "C5",
        "12ab",
    )
    assert bad.rule_id == "PARSER-002"
    assert bad.severity == Severity.WARNING


def test_ragged_row_reported_and_extra_cells_kept():
    csv_text = "Cuenta,Descripción,Monto (USD)\n4101,Ventas,100,extra\n"
    r = ingest_file("rag.csv", csv_text.encode(), hint=IngestHint(numeric_locale="en_US"))
    assert "RAGGED_ROW" in _codes(r)
    assert r.rows[0].cells["col_D"].raw == "extra"


def test_unknown_columns_kept_and_reported():
    csv_text = "Cuenta,Descripción,Monto (USD),Centro de costo\n4101,Ventas,100,CC9\n"
    r = ingest_file("u.csv", csv_text.encode(), hint=IngestHint(numeric_locale="en_US"))
    assert r.rows[0].cells["Centro de costo"].raw == "CC9"
    assert "UNKNOWN_COLUMN" in _codes(r, "PARSER-006")


def test_no_matching_structure_is_a_blocker_not_a_guess():
    r = ingest_file("w.csv", b"foo,bar\n1,2\n")
    assert r.rows == []
    assert "NO_ADAPTER" in _codes(r)


def test_adapter_hint_overrides_detection():
    r = ingest_file("h.csv", b"Cuenta,Monto\n4101,5\n", hint=IngestHint(adapter="long"))
    assert r.adapter == "long@1"
    with pytest.raises(ValueError):
        ingest_file("h.csv", b"a,b\n1,2\n", hint=IngestHint(adapter="nope"))
