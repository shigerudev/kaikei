"""
Ingestion -> normalization -> validation, happy path, against the real EMP1 pack
(SCOPE §2 K2-K4, MANIFESTO §4.1 ①-③).

EMP1 (01_AG_Distribucion_GT.csv) is the "long" format company (entidades.csv).
Every data row with a mapped account maps cleanly to a CanonicalRecord that
keeps its exact source cell; the one row that isn't data (the trailing
exchange-rate note) is skipped as a known structural feature, not a finding.
The planted duplicate (E01, answer_key_errors.csv) is still caught as a
traceable Finding pointing at both source rows.
"""

from __future__ import annotations

import hashlib
from decimal import Decimal
from pathlib import Path

from kaikei.domain.ingestion.csv_adapter import read_csv_rows
from kaikei.domain.normalization.long_format import LongLayout, LongMapping
from kaikei.domain.normalization.mapping_loader import load_account_mappings
from kaikei.domain.normalization.normalize import normalize
from kaikei.domain.validation.rules import find_duplicates

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"


def _emp1_mapping() -> LongMapping:
    structural = LongLayout(
        mapping_version="v1",
        company_id="EMP1",
        period_column="Mes",
        account_column="Cuenta",
        description_column="Descripción",
        amount_column="Monto (GTQ)",
        scenario_column="Escenario",
        currency="GTQ",
        scenario_map={
            "Presupuesto": "BUDGET_2027",
            "Real": "ACTUAL_2026",
            "Balance": "BALANCE_2027",
        },
    )
    accounts = load_account_mappings(FIXTURES / "answer_key_mapping.csv", "EMP1")
    return LongMapping(structural=structural, accounts=accounts)


def test_happy_path_ingests_and_normalizes_every_mapped_row():
    csv_path = FIXTURES / "01_AG_Distribucion_GT.csv"
    sha256, rows = read_csv_rows(csv_path)

    assert sha256 == hashlib.sha256(csv_path.read_bytes()).hexdigest()

    records, normalize_findings = normalize(rows, _emp1_mapping())

    assert normalize_findings == []  # every account EMP1 uses is in the mapping
    skipped_non_data_rows = sum(1 for row in rows if not row.raw["Cuenta"].strip())
    assert skipped_non_data_rows == 1  # the trailing exchange-rate note
    assert len(records) == len(rows) - skipped_non_data_rows

    jan_sales = next(
        r for r in records if r.period == "2027-01" and r.group_account_code == "REV_SALES"
    )
    assert jan_sales.amount_local == Decimal("2160000")
    assert jan_sales.currency == "GTQ"
    assert jan_sales.scenario_id == "BUDGET_2027"
    assert jan_sales.source.filename == "01_AG_Distribucion_GT.csv"
    assert jan_sales.source.row == 2  # line 2 of the CSV: "ene-2027,4101,Ventas locales,2160000,…"

    balance_cash = next(r for r in records if r.group_account_code == "CASH")
    assert balance_cash.period == "2027-12"


def test_traceability_when_erroring_catches_the_planted_duplicate():
    csv_path = FIXTURES / "01_AG_Distribucion_GT.csv"
    _sha256, rows = read_csv_rows(csv_path)
    records, _normalize_findings = normalize(rows, _emp1_mapping())

    duplicate_findings = find_duplicates(records)

    assert len(duplicate_findings) == 1
    finding = duplicate_findings[0]
    assert finding.rule_id == "VAL-006"
    assert [ref.row for ref in finding.source_refs] == [51, 52]
    assert all(ref.filename == "01_AG_Distribucion_GT.csv" for ref in finding.source_refs)
