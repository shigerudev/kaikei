"""K1 schema invariants checked on metadata only (no database needed)."""

from sqlalchemy import CHAR, Float, Numeric, UniqueConstraint

from kaikei.infrastructure.db import models  # noqa: F401
from kaikei.infrastructure.db.base import Base

TABLES = Base.metadata.tables

EXPECTED = {
    "groups",
    "companies",
    "company_aliases",
    "scenarios",
    "source_files",
    "source_rows",
    "group_accounts",
    "mapping_versions",
    "account_mappings",
    "canonical_records",
    "fx_rate_sets",
    "fx_rates",
    "consolidation_runs",
    "translated_records",
    "match_groups",
    "match_members",
    "adjustment_journals",
    "adjustment_lines",
    "journal_sources",
    "validation_findings",
    "finding_events",
    "consolidated_facts",
}

MONEY_COLUMNS = [
    ("canonical_records", "amount_local"),
    ("translated_records", "amount_group"),
    ("match_groups", "difference"),
    ("match_groups", "tolerance"),
    ("match_members", "amount_group"),
    ("adjustment_lines", "debit"),
    ("adjustment_lines", "credit"),
    ("consolidated_facts", "amount_group"),
    ("validation_findings", "expected"),
    ("validation_findings", "observed"),
    ("validation_findings", "difference"),
]


def test_all_manifesto_tables_present():
    assert EXPECTED <= set(TABLES)


def test_no_float_columns_anywhere():
    for table in TABLES.values():
        for col in table.columns:
            assert not isinstance(col.type, Float), f"{table.name}.{col.name} is Float"


def test_money_is_numeric_20_4_decimal():
    for table, col in MONEY_COLUMNS:
        t = TABLES[table].c[col].type
        assert isinstance(t, Numeric), (table, col)
        assert (t.precision, t.scale, t.asdecimal) == (20, 4, True), (table, col)


def test_fx_rate_is_numeric_20_10():
    t = TABLES["fx_rates"].c.rate.type
    assert (t.precision, t.scale, t.asdecimal) == (20, 10, True)


def test_currencies_are_char3():
    cols = [
        ("groups", "reporting_currency"),
        ("companies", "functional_currency"),
        ("canonical_records", "currency"),
        ("fx_rates", "from_ccy"),
        ("fx_rates", "to_ccy"),
        ("consolidated_facts", "currency_group"),
    ]
    for table, col in cols:
        t = TABLES[table].c[col].type
        assert isinstance(t, CHAR) and t.length == 3, (table, col)


def _uniques(table: str) -> set[tuple[str, ...]]:
    return {
        tuple(c.name for c in con.columns)
        for con in TABLES[table].constraints
        if isinstance(con, UniqueConstraint)
    }


def test_source_files_unique_group_sha256():
    assert ("group_id", "sha256") in _uniques("source_files")


def test_run_level_uniques():
    assert ("run_id", "canonical_record_id") in _uniques("translated_records")
    assert ("run_id", "match_group_id") in _uniques("adjustment_journals")
    assert ("group_id", "alias_normalized") in _uniques("company_aliases")


def test_source_rows_reference_source_files():
    fks = {fk.column.table.name for fk in TABLES["source_rows"].foreign_keys}
    assert "source_files" in fks
