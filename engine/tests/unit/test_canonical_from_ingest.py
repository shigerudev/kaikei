"""Generic canonical mapping from ingest rows — layout comes from the adapter."""

from decimal import Decimal

from kaikei.application.canonical import canonical_from_ingest
from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.ingestion.rows import SourceCell, SourceRow
from kaikei.domain.normalization.long_format import LongAccount
from kaikei.domain.normalization.models import Statement


def _cell(filename: str, row: int, column: str, raw: str, value) -> SourceCell:
    return SourceCell(
        ref=SourceRef(filename=filename, row=row, column=column, raw=raw),
        raw=raw,
        value=value,
    )


def test_long_row_maps_and_unmapped_is_val_003():
    filename = "pack.csv"
    mapped = SourceRow(
        row=2,
        kind="data",
        cells={
            "Cuenta": _cell(filename, 2, "Cuenta", "4101", "4101"),
            "Monto": _cell(filename, 2, "Monto", "100", Decimal("100")),
            "Mes": _cell(filename, 2, "Mes", "ene-2027", "ene-2027"),
        },
        roles={"account": "Cuenta", "amount": "Monto", "period": "Mes"},
        period="2027-01",
    )
    unmapped = SourceRow(
        row=3,
        kind="data",
        cells={
            "Cuenta": _cell(filename, 3, "Cuenta", "9999", "9999"),
            "Monto": _cell(filename, 3, "Monto", "1", Decimal("1")),
            "Mes": _cell(filename, 3, "Mes", "ene-2027", "ene-2027"),
        },
        roles={"account": "Cuenta", "amount": "Monto", "period": "Mes"},
        period="2027-01",
    )
    accounts = {
        "4101": LongAccount(
            local_code="4101", group_account_code="REV_SALES", statement=Statement.PL
        )
    }
    records, findings = canonical_from_ingest(
        filename=filename,
        rows=[mapped, unmapped],
        company_id="EMP1",
        currency="GTQ",
        accounts=accounts,
        mapping_version="v1",
        default_scenario="BUDGET_2027",
    )
    assert len(records) == 1
    assert records[0].amount_local == Decimal("100")
    assert records[0].group_account_code == "REV_SALES"
    assert {f.rule_id for f in findings} == {"VAL-003"}
