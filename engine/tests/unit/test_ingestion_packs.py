"""PIPER-61: the six Grupo AG packs ingest. Expected values were read by hand from the CSVs."""

import hashlib
from collections import Counter
from decimal import Decimal
from pathlib import Path

import pytest

from kaikei.domain.ingestion import IngestHint, ingest_file

PACK = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"

# Per-company configuration (not code branches): locale + wide-header year.
HINTS = {
    "01_AG_Distribucion_GT.csv": IngestHint(numeric_locale="es_GT"),
    "02_AG_Manufactura_GT.csv": IngestHint(numeric_locale="es_GT", default_year=2027),
    "03_AG_ElSalvador.csv": IngestHint(numeric_locale="en_US"),
    "04_AG_Panama.csv": IngestHint(numeric_locale="en_US"),
    "05_AG_Espana.csv": IngestHint(numeric_locale="es_ES"),
    "06_AG_Holding.csv": IngestHint(numeric_locale="en_US"),
}


def load(name, hint="default"):
    data = (PACK / name).read_bytes()
    h = HINTS[name] if hint == "default" else hint
    return ingest_file(name, data, hint=h)


def row_at(result, line):
    return next(r for r in result.rows if r.row == line)


# (file, adapter, total SourceRows, header rows, kind counts) -- counted from the files by hand:
# 01: 155 lines - 1 header; 02: 43 lines - 3 headers; 03: 137-1; 04: 124-1; 05: 128-2 preamble-1;
# 06: 136-1.
EXPECTED = [
    ("01_AG_Distribucion_GT.csv", "long@1", 154, [1], {"data": 153, "note": 1}),
    (
        "02_AG_Manufactura_GT.csv",
        "wide@1",
        40,
        [1, 21, 32],
        {"section": 2, "data": 31, "subtotal": 3, "blank": 3, "note": 1},
    ),
    ("03_AG_ElSalvador.csv", "long@1", 136, [1], {"data": 136}),
    ("04_AG_Panama.csv", "long@1", 123, [1], {"data": 123}),
    ("05_AG_Espana.csv", "long@1", 125, [3], {"data": 125}),
    ("06_AG_Holding.csv", "debit_credit@1", 135, [1], {"data": 135}),
]


@pytest.mark.parametrize(("name", "adapter", "n", "headers", "kinds"), EXPECTED)
def test_pack_ingests(name, adapter, n, headers, kinds):
    r = load(name)
    assert r.accepted
    assert r.adapter == adapter
    assert len(r.rows) == n
    assert r.header_rows == headers
    assert dict(Counter(x.kind for x in r.rows)) == kinds
    assert r.sha256 == hashlib.sha256((PACK / name).read_bytes()).hexdigest()
    assert not [f for f in r.findings if f.severity.value == "BLOCKER"]


@pytest.mark.parametrize("name", list(HINTS))
def test_repeat_ingest_identical(name):
    a, b = load(name), load(name)
    assert a.sha256 == b.sha256
    assert [(x.row, x.kind, {k: c.raw for k, c in x.cells.items()}) for x in a.rows] == [
        (x.row, x.kind, {k: c.raw for k, c in x.cells.items()}) for x in b.rows
    ]
    assert [f.model_dump_json() for f in a.findings] == [f.model_dump_json() for f in b.findings]


@pytest.mark.parametrize("name", list(HINTS))
def test_every_cell_carries_its_source_ref(name):
    r = load(name)
    for row in r.rows:
        for header, cell in row.cells.items():
            assert cell.ref.filename == name
            assert cell.ref.sheet is None
            assert cell.ref.row == row.row
            assert cell.ref.column == header
            assert cell.ref.cell and cell.ref.cell.endswith(str(row.row))
            assert cell.ref.raw == cell.raw


# ---- per-pack findings ----------------------------------------------------


def test_clean_packs_have_no_findings_beyond_info():
    for name in (
        "01_AG_Distribucion_GT.csv",
        "02_AG_Manufactura_GT.csv",
        "03_AG_ElSalvador.csv",
        "04_AG_Panama.csv",
        "06_AG_Holding.csv",
    ):
        assert load(name).findings == [], name


def test_espana_findings_are_preamble_and_e09_only():
    r = load("05_AG_Espana.csv")
    assert sorted((f.rule_id, f.reason_code) for f in r.findings) == [
        ("PARSER-001", "PREAMBLE_SKIPPED"),
        ("PARSER-002", "LOCALE_MISMATCH"),
    ]


# ---- 01 long, Spanish month labels ----------------------------------------


def test_01_distribucion_cells():
    r = load("01_AG_Distribucion_GT.csv")
    row = row_at(r, 2)  # ene-2027,4101,Ventas locales,2160000,Presupuesto,
    assert row.period == "2027-01"
    assert row.cells["Cuenta"].raw == "4101"
    assert row.cells["Monto (GTQ)"].raw == "2160000"
    assert row.cells["Monto (GTQ)"].value == Decimal("2160000")
    assert row.cells["Contraparte"].raw == ""
    assert row.cells["Contraparte"].value is None
    assert r.header_currency == "GTQ"
    assert row.roles["amount"] == "Monto (GTQ)"
    # line 26: mar-2027 Compras a AG Manufactura 472500 (E02 seller/buyer pair)
    mar = row_at(r, 26)
    assert mar.period == "2027-03"
    assert mar.cells["Monto (GTQ)"].value == Decimal("472500")
    # lines 51 and 52 are the same row twice (E01); ingestion keeps both, drops nothing
    a, b = row_at(r, 51), row_at(r, 52)
    for x in (a, b):
        assert x.cells["Cuenta"].raw == "6301"
        assert x.period == "2027-05"
        assert x.cells["Monto (GTQ)"].value == Decimal("60000")
    # scenario column kept; trailing note row flagged and recorded (it carries the 7.70 rate)
    assert row_at(r, 3).cells["Escenario"].raw == "Presupuesto"
    note = row_at(r, 155)
    assert note.kind == "note"
    assert "7.70" in note.cells["Descripción"].raw
    assert row_at(r, 148).cells["Escenario"].raw == "Balance"


# ---- 02 wide, stacked blocks, hardcoded subtotals --------------------------


def test_02_manufactura_wide_blocks():
    r = load("02_AG_Manufactura_GT.csv")
    assert row_at(r, 2).kind == "section"  # INGRESOS
    assert row_at(r, 18).kind == "blank"
    assert row_at(r, 19).kind == "note"
    v = row_at(r, 3)  # Ventas a terceros
    assert v.kind == "data"
    assert v.block == "B1"
    assert v.cells["Concepto"].raw == "Ventas a terceros"
    assert v.cells["Ene"].value == Decimal("1350000")
    assert v.period_by_column["Ene"] == "2027-01"
    assert v.period_by_column["Dic"] == "2027-12"
    assert v.period_by_column["Total"] is None
    assert "total_column" in v.cells["Total"].flags
    assert v.cells["Total"].raw == "18150000"
    es = row_at(r, 5)
    assert es.cells["Feb"].raw == "164687.5"
    assert es.cells["Feb"].value == Decimal("164687.5")
    assert es.cells["Feb"].ref.cell == "C5"
    # hardcoded subtotal (E03 location): flagged, value preserved as written, not recomputed
    sub = row_at(r, 15)
    assert sub.kind == "subtotal"
    assert "subtotal" in sub.flags
    assert sub.cells["Jun"].value == Decimal("1859750")
    assert "hardcoded_subtotal" in sub.cells["Jun"].flags
    assert sub.cells["Jun"].ref.cell == "G15"
    assert row_at(r, 16).kind == "subtotal"  # Utilidad antes de impuestos
    # stacked block 2: balance sheet dated 31-dic-2027
    ef = row_at(r, 22)
    assert ef.block == "B2"
    assert ef.cells["Rubro"].raw == "Efectivo"
    assert ef.cells["31-dic-2027 (Q)"].value == Decimal("900000")
    assert ef.period_by_column["31-dic-2027 (Q)"] == "2027-12"
    # stacked block 3: 2026 actuals, annual period
    a = row_at(r, 33)
    assert a.block == "B3"
    assert a.cells["Real 2026 (Q)"].value == Decimal("18876000")
    assert a.period_by_column["Real 2026 (Q)"] == "2026"


def test_02_without_year_hint_reports_missing_period():
    r = load("02_AG_Manufactura_GT.csv", hint=IngestHint(numeric_locale="es_GT"))
    codes = [f.reason_code for f in r.findings]
    assert codes.count("PERIOD_YEAR_MISSING") == 12
    assert row_at(r, 3).period_by_column["Ene"] is None


# ---- 03 long, YYYY-MM ------------------------------------------------------


def test_03_elsalvador_cells():
    r = load("03_AG_ElSalvador.csv")
    row = row_at(r, 2)  # 2027-01,40-01,Ventas netas,resultado,USD,279000.00,,presupuesto
    assert row.period == "2027-01"
    assert row.cells["codigo"].raw == "40-01"
    assert row.cells["valor"].raw == "279000.00"
    assert row.cells["valor"].value == Decimal("279000.00")
    assert row.roles["account"] == "codigo"
    assert row.roles["description"] == "cuenta"
    assert row.roles["scenario"] == "escenario"
    assert row.roles["statement_type"] == "tipo"
    # E04 location: negative revenue is a valid number here, kept as-is (validation flags it)
    neg = row_at(r, 71)
    assert neg.period == "2027-08"
    assert neg.cells["valor"].raw == "-310000.00"
    assert neg.cells["valor"].value == Decimal("-310000.00")
    # 2026 annual rows
    assert row_at(r, 121).period == "2026"
    # E05: no row for 2027-07 / 60-03 (missing, not zero)
    assert not [x for x in r.rows if x.period == "2027-07" and x.cells["codigo"].raw == "60-03"]
    assert len([x for x in r.rows if x.cells["codigo"].raw == "60-03" and x.period]) == 11 + 1


# ---- 04 quoted parentheses negatives, dd/mm/yyyy ---------------------------


def test_04_panama_parentheses_negatives():
    r = load("04_AG_Panama.csv")
    inc = row_at(r, 2)  # 31/01/2027,4.1.01,...,USD,"234,000.00",,Presupuesto
    assert inc.period == "2027-01"
    assert inc.cells["Importe"].raw == "234,000.00"
    assert inc.cells["Importe"].value == Decimal("234000.00")
    exp = row_at(r, 3)
    assert exp.cells["Importe"].raw == "(85,500.00)"
    assert exp.cells["Importe"].value == Decimal("-85500.00")
    # E06 location: the currency cell is kept as written for the validator
    assert row_at(r, 32).cells["Moneda"].raw == "GTQ"
    assert row_at(r, 32).cells["Importe"].value == Decimal("-108500.00")
    # E07 location
    unm = row_at(r, 101)
    assert unm.cells["Código"].raw == "9.9.99"
    assert unm.cells["Importe"].value == Decimal("-3200.00")
    assert unm.period == "2027-11"
    # E08: Panamá has no 6.1.05 in December
    assert not [
        x
        for x in r.rows
        if x.period == "2027-12"
        and x.cells["Código"].raw == "6.1.05"
        and x.cells["Tipo"].raw == "Presupuesto"
    ]
    assert row_at(r, 122).period == "2026-12"  # 31/12/2026 Real 2026 row
    assert row_at(r, 122).cells["Importe"].value == Decimal("-183600.00")


# ---- 05 decimal comma + preamble -------------------------------------------


def test_05_espana_decimal_comma_and_preamble():
    r = load("05_AG_Espana.csv")
    assert r.delimiter == ";"
    assert [(p.row, p.text) for p in r.preamble] == [
        (1, "# AG España S.L. - Presupuesto 2027"),
        (2, "# Tipo de cambio presupuesto EUR/USD 1,05"),  # E11c evidence preserved
    ]
    row = row_at(r, 4)  # 2027;1;700;Ventas de mercaderías;378.000,00;Presupuesto;
    assert row.period == "2027-01"
    assert row.cells["Importe (€)"].raw == "378.000,00"
    assert row.cells["Importe (€)"].value == Decimal("378000.00")
    assert r.header_currency == "EUR"
    assert row_at(r, 5).cells["Importe (€)"].value == Decimal("162000.00")
    assert row_at(r, 5).cells["Importe (€)"].ref.cell == "E5"
    # annual 2026 rows: month deliberately empty, annual period
    assert row_at(r, 114).period == "2026"
    assert row_at(r, 114).cells["Mes"].raw == ""
    assert row_at(r, 114).cells["Importe (€)"].value == Decimal("1241460.00")


def test_05_e09_number_format_finding():
    r = load("05_AG_Espana.csv")
    bad = [f for f in r.findings if f.reason_code == "LOCALE_MISMATCH"]
    assert len(bad) == 1
    ref = bad[0].source_refs[0]
    assert (ref.row, ref.cell, ref.column, ref.raw) == (80, "E80", "Importe (€)", "11400.00")
    assert bad[0].rule_id == "PARSER-002"
    assert bad[0].severity.value == "WARNING"
    cell = row_at(r, 80).cells["Importe (€)"]
    # parsed as 11,400.00 (not 1,140,000) and flagged
    assert cell.value == Decimal("11400.00")
    assert "locale_mismatch" in cell.flags


def test_05_semicolon_without_hint_infers_decimal_comma():
    r = load("05_AG_Espana.csv", hint=IngestHint())
    assert r.numeric_locale == "decimal_comma"
    assert row_at(r, 4).cells["Importe (€)"].value == Decimal("378000.00")
    assert "LOCALE_INFERRED" in [f.reason_code for f in r.findings]


# ---- 06 debit / credit ------------------------------------------------------


def test_06_holding_debit_credit():
    r = load("06_AG_Holding.csv")
    row = row_at(r, 2)  # 31-Jan-2027,R100,Management fees - AG Distribución GT,,15000,EMP1,Budget
    assert row.period == "2027-01"
    assert row.cells["Debit (USD)"].raw == ""
    assert row.cells["Debit (USD)"].value is None  # blank is not zero
    assert row.cells["Credit (USD)"].value == Decimal("15000")
    assert row.cells["Intercompany"].raw == "EMP1"
    assert r.header_currency == "USD"
    exp = row_at(r, 7)  # 31-Jan-2027,E100,Salaries - corporate,38000,,,Budget
    assert exp.cells["Debit (USD)"].value == Decimal("38000")
    assert exp.cells["Credit (USD)"].value is None
    assert exp.cells["Credit (USD)"].raw == ""
    assert row_at(r, 114).cells["Account"].raw == "R102"  # E08 evidence (Dec fee to EMP4)
    assert row_at(r, 114).period == "2027-12"
    assert row_at(r, 122).period == "2026"  # FY2026


def test_ingestion_stage_answer_key_errors_are_found():
    """answer_key_errors.csv: only E09 is detectable at ingestion; the rest need validation."""
    key = (PACK / "answer_key_errors.csv").read_text(encoding="utf-8")
    assert "E09,EMP5,05_AG_Espana.csv,line 80,number_format" in key
    r = load("05_AG_Espana.csv")
    assert any(
        f.reason_code == "LOCALE_MISMATCH" and f.source_refs[0].row == 80 for f in r.findings
    )


def test_latin1_encoded_pack_ingests_identically():
    name = "05_AG_Espana.csv"
    utf8 = load(name)
    text = (PACK / name).read_text(encoding="utf-8")
    r = ingest_file(name, text.encode("cp1252"), hint=HINTS[name])
    assert r.encoding == "cp1252"
    assert len(r.rows) == len(utf8.rows)
    assert row_at(r, 4).cells["Descripción"].raw == "Ventas de mercaderías"
    assert row_at(r, 4).cells["Importe (€)"].value == Decimal("378000.00")
    assert r.preamble[0].text == "# AG España S.L. - Presupuesto 2027"
