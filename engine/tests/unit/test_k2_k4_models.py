"""PIPER-58: K2/K3/K4 Pydantic contracts — Decimal JSON strings + PLAN shapes."""

from __future__ import annotations

from decimal import Decimal

import pytest

from kaikei.domain.ingestion import SourceRef
from kaikei.domain.normalization import (
    AccountMapping,
    CanonicalRecord,
    MappingConfig,
    SignRule,
    Statement,
    StructuralMapping,
)
from kaikei.domain.validation import Finding, FindingStatus, Severity


def test_source_ref_roundtrip():
    ref = SourceRef(
        file_id="FILE-EMP1",
        filename="01_AG_Distribucion_GT.csv",
        sheet=None,
        row=26,
        column="D",
        cell="01_AG_Distribucion_GT.csv!D26",
        raw="472500",
    )
    data = ref.model_dump(mode="json")
    assert SourceRef.model_validate(data) == ref


def test_canonical_amount_json_string_roundtrip():
    rec = CanonicalRecord(
        record_id="REC-1",
        source=SourceRef(filename="01_AG_Distribucion_GT.csv", row=2, column="D"),
        company_id="EMP1",
        scenario_id="BUDGET_2027",
        scenario_year="2027",
        period="2027-01",
        statement=Statement.PL,
        group_account_code="REV_SALES",
        amount_local=Decimal("2160000.0000"),
        currency="gtq",
        mapping_version="MAP-V1",
    )
    payload = rec.model_dump(mode="json")
    assert payload["amount_local"] == "2160000.0000"
    assert isinstance(payload["amount_local"], str)
    assert payload["currency"] == "GTQ"
    again = CanonicalRecord.model_validate(payload)
    assert again.amount_local == Decimal("2160000.0000")


def test_canonical_allows_annual_period_yyyy():
    """Jose decision: 2026 actuals use YYYY, not twelve invented months."""
    rec = CanonicalRecord(
        record_id="REC-2026",
        source=SourceRef(filename="01_AG_Distribucion_GT.csv", row=100, column="B"),
        company_id="EMP1",
        scenario_id="ACTUAL_2026",
        scenario_year="2026",
        period="2026",
        statement=Statement.PL,
        group_account_code="REV_SALES",
        amount_local=Decimal("1.00"),
        currency="GTQ",
        mapping_version="MAP-V1",
    )
    assert rec.period == "2026"


def test_canonical_rejects_bad_period():
    with pytest.raises(ValueError):
        CanonicalRecord(
            record_id="x",
            source=SourceRef(filename="f.csv", row=1),
            company_id="EMP1",
            scenario_id="BUDGET_2027",
            scenario_year="2027",
            period="2027-13",
            statement=Statement.PL,
            group_account_code="REV_SALES",
            amount_local=Decimal("1"),
            currency="USD",
            mapping_version="MAP-V1",
        )


def test_structural_mapping_plan_62_shape():
    structural = StructuralMapping(
        mapping_version="MAP-V1",
        company_id="EMP1",
        sheet="Presupuesto",
        header_row=3,
        account_code_column="Cuenta",
        description_column="Descripción",
        amount_columns={"Enero": "2027-01", "Febrero": "2027-02"},
        counterparty_column="Empresa vinculada",
        numeric_locale="es_GT",
        sign_rule=SignRule.NORMAL_BALANCE,
        defaults={"currency": "GTQ", "scenario": "BUDGET"},
    )
    data = structural.model_dump(mode="json")
    assert data["amount_columns"]["Enero"] == "2027-01"
    assert StructuralMapping.model_validate(data).numeric_locale == "es_GT"


def test_account_mapping_plan_63_shape():
    row = AccountMapping(
        mapping_version="COA-2027-V1",
        company_id="EMP1",
        source_account_code="4001",
        group_account_code="REVENUE_EXTERNAL",
        account_type="REVENUE",
        normal_balance="CREDIT",
        sign_multiplier=1,
        fx_policy="P_AND_L_AVERAGE",
        effective_from="2027-01",
    )
    data = row.model_dump(mode="json")
    assert data["sign_multiplier"] == 1
    assert AccountMapping.model_validate(data).group_account_code == "REVENUE_EXTERNAL"


def test_mapping_config_bundle():
    cfg = MappingConfig(
        structural=StructuralMapping(
            mapping_version="MAP-V1",
            company_id="EMP6",
            header_row=1,
            debit_column="Debit",
            credit_column="Credit",
            sign_rule=SignRule.DEBIT_CREDIT_COLUMNS,
        ),
        accounts=[
            AccountMapping(
                mapping_version="COA-V1",
                company_id="EMP6",
                source_account_code="4000",
                group_account_code="REV_IC",
                account_type="REVENUE",
                normal_balance="CREDIT",
                ic_eligible=True,
            )
        ],
    )
    assert len(cfg.accounts) == 1


def test_finding_plan_92_amounts_as_strings():
    finding = Finding(
        finding_id="FIND-021",
        run_id="RUN-003",
        rule_id="VAL-008",
        rule_version="1.2.0",
        severity=Severity.WARNING,
        status=FindingStatus.OPEN,
        affected_record_ids=["REC-097", "REC-122"],
        expected=Decimal("100000.00"),
        observed=Decimal("98000.00"),
        difference=Decimal("2000.00"),
        currency="GTQ",
        reason="Intercompany amount mismatch",
        reason_code="INTERCOMPANY_AMOUNT_MISMATCH",
        source_refs=[
            SourceRef(filename="01_AG_Distribucion_GT.csv", row=26, column="D"),
            SourceRef(filename="02_AG_Manufactura_GT.csv", row=4, column="D"),
        ],
        reference="E02",
    )
    payload = finding.model_dump(mode="json")
    assert payload["expected"] == "100000.00"
    assert payload["observed"] == "98000.00"
    assert payload["difference"] == "2000.00"
    assert all(isinstance(payload[k], str) for k in ("expected", "observed", "difference"))
    again = Finding.model_validate(payload)
    assert again.difference == Decimal("2000.00")
    assert again.severity is Severity.WARNING
