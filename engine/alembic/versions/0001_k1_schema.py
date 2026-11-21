"""k1 schema

Revision ID: 0001
Revises:
Create Date: 2026-11-21 14:55:57.115307

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "groups",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("reporting_currency", sa.CHAR(length=3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_groups")),
    )
    op.create_table(
        "companies",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("country", sa.String(length=2), nullable=True),
        sa.Column("functional_currency", sa.CHAR(length=3), nullable=False),
        sa.Column("ownership_pct", sa.Numeric(precision=7, scale=4), nullable=False),
        sa.Column("consolidation_method", sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_companies_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_companies")),
        sa.UniqueConstraint("group_id", "name", name=op.f("uq_companies_group_id_name")),
    )
    op.create_index(op.f("ix_companies_group_id"), "companies", ["group_id"], unique=False)
    op.create_table(
        "fx_rate_sets",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("reporting_currency", sa.CHAR(length=3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_fx_rate_sets_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fx_rate_sets")),
        sa.UniqueConstraint("group_id", "name", name=op.f("uq_fx_rate_sets_group_id_name")),
    )
    op.create_table(
        "group_accounts",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("statement", sa.String(length=2), nullable=False),
        sa.Column("account_type", sa.String(length=64), nullable=False),
        sa.Column("normal_balance", sa.String(length=6), nullable=False),
        sa.Column("ic_eligible", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "normal_balance IN ('DEBIT', 'CREDIT')", name=op.f("ck_group_accounts_normal_balance")
        ),
        sa.CheckConstraint("statement IN ('PL', 'BS')", name=op.f("ck_group_accounts_statement")),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_group_accounts_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_accounts")),
        sa.UniqueConstraint("group_id", "code", name=op.f("uq_group_accounts_group_id_code")),
    )
    op.create_table(
        "scenarios",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("fiscal_year", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_scenarios_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scenarios")),
        sa.UniqueConstraint("group_id", "code", name=op.f("uq_scenarios_group_id_code")),
    )
    op.create_table(
        "company_aliases",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("alias", sa.String(length=200), nullable=False),
        sa.Column("alias_normalized", sa.String(length=200), nullable=False),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_company_aliases_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_company_aliases_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_company_aliases")),
        sa.UniqueConstraint(
            "group_id",
            "alias_normalized",
            name=op.f("uq_company_aliases_group_id_alias_normalized"),
        ),
    )
    op.create_index(
        op.f("ix_company_aliases_company_id"), "company_aliases", ["company_id"], unique=False
    )
    op.create_table(
        "consolidation_runs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("scenario_id", sa.UUID(), nullable=False),
        sa.Column("rate_set_id", sa.UUID(), nullable=False),
        sa.Column("rule_set_version", sa.String(length=64), nullable=False),
        sa.Column("mapping_version", sa.String(length=64), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("inputs", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('CREATED', 'RUNNING', 'DRAFT', 'BLOCKED', 'READY_FOR_REVIEW', 'PUBLISHED', 'FAILED')",
            name=op.f("ck_consolidation_runs_status"),
        ),
        sa.CheckConstraint(
            "char_length(fingerprint) = 64", name=op.f("ck_consolidation_runs_fingerprint_len")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_consolidation_runs_group_id_groups")
        ),
        sa.ForeignKeyConstraint(
            ["rate_set_id"],
            ["fx_rate_sets.id"],
            name=op.f("fk_consolidation_runs_rate_set_id_fx_rate_sets"),
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["scenarios.id"],
            name=op.f("fk_consolidation_runs_scenario_id_scenarios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consolidation_runs")),
    )
    op.create_index(
        op.f("ix_consolidation_runs_fingerprint"),
        "consolidation_runs",
        ["fingerprint"],
        unique=False,
    )
    op.create_index(
        op.f("ix_consolidation_runs_group_id"), "consolidation_runs", ["group_id"], unique=False
    )
    op.create_table(
        "fx_rates",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("rate_set_id", sa.UUID(), nullable=False),
        sa.Column("from_ccy", sa.CHAR(length=3), nullable=False),
        sa.Column("to_ccy", sa.CHAR(length=3), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("rate_type", sa.String(length=8), nullable=False),
        sa.Column("rate", sa.Numeric(precision=20, scale=10), nullable=False),
        sa.Column("source", sa.String(length=200), nullable=False),
        sa.CheckConstraint(
            "period ~ '^[0-9]{4}(-[0-9]{2})?$'", name=op.f("ck_fx_rates_period_shape")
        ),
        sa.CheckConstraint(
            "rate_type IN ('average', 'closing')", name=op.f("ck_fx_rates_rate_type")
        ),
        sa.CheckConstraint("rate > 0", name=op.f("ck_fx_rates_rate_positive")),
        sa.ForeignKeyConstraint(
            ["rate_set_id"], ["fx_rate_sets.id"], name=op.f("fk_fx_rates_rate_set_id_fx_rate_sets")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fx_rates")),
        sa.UniqueConstraint(
            "rate_set_id",
            "from_ccy",
            "to_ccy",
            "period",
            "rate_type",
            name=op.f("uq_fx_rates_rate_set_id_from_ccy_to_ccy_period_rate_type"),
        ),
    )
    op.create_index(op.f("ix_fx_rates_rate_set_id"), "fx_rates", ["rate_set_id"], unique=False)
    op.create_table(
        "mapping_versions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.String(length=64), nullable=False),
        sa.Column("structural", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("approved_by", sa.String(length=200), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_mapping_versions_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_mapping_versions_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mapping_versions")),
        sa.UniqueConstraint(
            "group_id",
            "company_id",
            "version",
            name=op.f("uq_mapping_versions_group_id_company_id_version"),
        ),
    )
    op.create_table(
        "source_files",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=True),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("stored_uri", sa.Text(), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_source_files_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_source_files_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_source_files")),
        sa.UniqueConstraint("group_id", "sha256", name=op.f("uq_source_files_group_id_sha256")),
    )
    op.create_index(
        op.f("ix_source_files_company_id"), "source_files", ["company_id"], unique=False
    )
    op.create_table(
        "account_mappings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("mapping_version_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("local_code", sa.String(length=64), nullable=False),
        sa.Column("local_name", sa.String(length=200), nullable=True),
        sa.Column("group_account_id", sa.UUID(), nullable=False),
        sa.Column("sign_multiplier", sa.Integer(), nullable=False),
        sa.Column("fx_policy", sa.String(length=64), nullable=True),
        sa.Column("partner_company_id", sa.UUID(), nullable=True),
        sa.Column("effective_from", sa.String(length=7), nullable=True),
        sa.CheckConstraint(
            "sign_multiplier IN (-1, 1)", name=op.f("ck_account_mappings_sign_multiplier")
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_account_mappings_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["group_account_id"],
            ["group_accounts.id"],
            name=op.f("fk_account_mappings_group_account_id_group_accounts"),
        ),
        sa.ForeignKeyConstraint(
            ["mapping_version_id"],
            ["mapping_versions.id"],
            name=op.f("fk_account_mappings_mapping_version_id_mapping_versions"),
        ),
        sa.ForeignKeyConstraint(
            ["partner_company_id"],
            ["companies.id"],
            name=op.f("fk_account_mappings_partner_company_id_companies"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_account_mappings")),
        sa.UniqueConstraint(
            "mapping_version_id",
            "local_code",
            name=op.f("uq_account_mappings_mapping_version_id_local_code"),
        ),
    )
    op.create_index(
        op.f("ix_account_mappings_company_id"), "account_mappings", ["company_id"], unique=False
    )
    op.create_table(
        "consolidated_facts",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("group_account_id", sa.UUID(), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("amount_group", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("currency_group", sa.CHAR(length=3), nullable=False),
        sa.CheckConstraint(
            "period ~ '^[0-9]{4}(-[0-9]{2})?$'", name=op.f("ck_consolidated_facts_period_shape")
        ),
        sa.ForeignKeyConstraint(
            ["group_account_id"],
            ["group_accounts.id"],
            name=op.f("fk_consolidated_facts_group_account_id_group_accounts"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["consolidation_runs.id"],
            name=op.f("fk_consolidated_facts_run_id_consolidation_runs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_consolidated_facts")),
        sa.UniqueConstraint(
            "run_id",
            "group_account_id",
            "period",
            name=op.f("uq_consolidated_facts_run_id_group_account_id_period"),
        ),
    )
    op.create_index(
        op.f("ix_consolidated_facts_run_id"), "consolidated_facts", ["run_id"], unique=False
    )
    op.create_table(
        "match_groups",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("difference", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("tolerance", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("rule_version", sa.String(length=64), nullable=False),
        sa.CheckConstraint(
            "mode IN ('transaction', 'aggregate')", name=op.f("ck_match_groups_mode")
        ),
        sa.CheckConstraint(
            "status IN ('matched', 'mismatch', 'one_sided', 'unmatched')",
            name=op.f("ck_match_groups_status"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["consolidation_runs.id"],
            name=op.f("fk_match_groups_run_id_consolidation_runs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_match_groups")),
        sa.UniqueConstraint("id", "run_id", name=op.f("uq_match_groups_id_run_id")),
    )
    op.create_index(op.f("ix_match_groups_run_id"), "match_groups", ["run_id"], unique=False)
    op.create_table(
        "source_rows",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_file_id", sa.UUID(), nullable=False),
        sa.Column("sheet", sa.String(length=200), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("cell_refs", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint("row_number >= 1", name=op.f("ck_source_rows_row_number_pos")),
        sa.ForeignKeyConstraint(
            ["source_file_id"],
            ["source_files.id"],
            name=op.f("fk_source_rows_source_file_id_source_files"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_source_rows")),
        sa.UniqueConstraint(
            "source_file_id",
            "sheet",
            "row_number",
            name=op.f("uq_source_rows_source_file_id_sheet_row_number"),
        ),
    )
    op.create_index(
        op.f("ix_source_rows_source_file_id"), "source_rows", ["source_file_id"], unique=False
    )
    op.create_table(
        "adjustment_journals",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("match_group_id", sa.UUID(), nullable=False),
        sa.Column("rule_id", sa.String(length=64), nullable=False),
        sa.Column("rule_version", sa.String(length=64), nullable=False),
        sa.Column("currency", sa.CHAR(length=3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["match_group_id"],
            ["match_groups.id"],
            name=op.f("fk_adjustment_journals_match_group_id_match_groups"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["consolidation_runs.id"],
            name=op.f("fk_adjustment_journals_run_id_consolidation_runs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_adjustment_journals")),
        sa.UniqueConstraint(
            "run_id", "match_group_id", name=op.f("uq_adjustment_journals_run_id_match_group_id")
        ),
    )
    op.create_index(
        op.f("ix_adjustment_journals_run_id"), "adjustment_journals", ["run_id"], unique=False
    )
    op.create_table(
        "canonical_records",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_row_id", sa.UUID(), nullable=False),
        sa.Column("source_cell", sa.String(length=64), nullable=True),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("scenario_id", sa.UUID(), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("group_account_id", sa.UUID(), nullable=False),
        sa.Column("amount_local", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("currency", sa.CHAR(length=3), nullable=False),
        sa.Column("partner_company_id", sa.UUID(), nullable=True),
        sa.Column("partner_text", sa.String(length=200), nullable=True),
        sa.Column("mapping_version_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "period ~ '^[0-9]{4}(-[0-9]{2})?$'", name=op.f("ck_canonical_records_period_shape")
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_canonical_records_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["group_account_id"],
            ["group_accounts.id"],
            name=op.f("fk_canonical_records_group_account_id_group_accounts"),
        ),
        sa.ForeignKeyConstraint(
            ["mapping_version_id"],
            ["mapping_versions.id"],
            name=op.f("fk_canonical_records_mapping_version_id_mapping_versions"),
        ),
        sa.ForeignKeyConstraint(
            ["partner_company_id"],
            ["companies.id"],
            name=op.f("fk_canonical_records_partner_company_id_companies"),
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["scenarios.id"],
            name=op.f("fk_canonical_records_scenario_id_scenarios"),
        ),
        sa.ForeignKeyConstraint(
            ["source_row_id"],
            ["source_rows.id"],
            name=op.f("fk_canonical_records_source_row_id_source_rows"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_canonical_records")),
    )
    op.create_index(
        op.f("ix_canonical_records_company_id"), "canonical_records", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_canonical_records_source_row_id"),
        "canonical_records",
        ["source_row_id"],
        unique=False,
    )
    op.create_table(
        "validation_findings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=True),
        sa.Column("rule_id", sa.String(length=64), nullable=False),
        sa.Column("rule_version", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("source_row_id", sa.UUID(), nullable=True),
        sa.Column("source_cell", sa.String(length=64), nullable=True),
        sa.Column("affected_record_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("expected", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("observed", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("difference", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("currency", sa.CHAR(length=3), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("reason_code", sa.String(length=64), nullable=True),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "severity IN ('BLOCKER', 'WARNING', 'INFO')",
            name=op.f("ck_validation_findings_severity"),
        ),
        sa.CheckConstraint(
            "status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ACCEPTED_RISK', 'SUPERSEDED')",
            name=op.f("ck_validation_findings_status"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["consolidation_runs.id"],
            name=op.f("fk_validation_findings_run_id_consolidation_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["source_row_id"],
            ["source_rows.id"],
            name=op.f("fk_validation_findings_source_row_id_source_rows"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_validation_findings")),
    )
    op.create_index(
        op.f("ix_validation_findings_rule_id"), "validation_findings", ["rule_id"], unique=False
    )
    op.create_index(
        op.f("ix_validation_findings_run_id"), "validation_findings", ["run_id"], unique=False
    )
    op.create_table(
        "adjustment_lines",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("journal_id", sa.UUID(), nullable=False),
        sa.Column("group_account_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=True),
        sa.Column("debit", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("credit", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.CheckConstraint(
            "(debit > 0) <> (credit > 0)", name=op.f("ck_adjustment_lines_one_side")
        ),
        sa.CheckConstraint(
            "debit >= 0 AND credit >= 0", name=op.f("ck_adjustment_lines_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_adjustment_lines_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["group_account_id"],
            ["group_accounts.id"],
            name=op.f("fk_adjustment_lines_group_account_id_group_accounts"),
        ),
        sa.ForeignKeyConstraint(
            ["journal_id"],
            ["adjustment_journals.id"],
            name=op.f("fk_adjustment_lines_journal_id_adjustment_journals"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_adjustment_lines")),
    )
    op.create_index(
        op.f("ix_adjustment_lines_journal_id"), "adjustment_lines", ["journal_id"], unique=False
    )
    op.create_table(
        "finding_events",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("finding_id", sa.UUID(), nullable=False),
        sa.Column("actor", sa.String(length=200), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("resulting_run_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["validation_findings.id"],
            name=op.f("fk_finding_events_finding_id_validation_findings"),
        ),
        sa.ForeignKeyConstraint(
            ["resulting_run_id"],
            ["consolidation_runs.id"],
            name=op.f("fk_finding_events_resulting_run_id_consolidation_runs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_finding_events")),
    )
    op.create_index(
        op.f("ix_finding_events_finding_id"), "finding_events", ["finding_id"], unique=False
    )
    op.create_table(
        "translated_records",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("canonical_record_id", sa.UUID(), nullable=False),
        sa.Column("fx_rate_id", sa.UUID(), nullable=False),
        sa.Column("amount_group", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("currency_group", sa.CHAR(length=3), nullable=False),
        sa.ForeignKeyConstraint(
            ["canonical_record_id"],
            ["canonical_records.id"],
            name=op.f("fk_translated_records_canonical_record_id_canonical_records"),
        ),
        sa.ForeignKeyConstraint(
            ["fx_rate_id"], ["fx_rates.id"], name=op.f("fk_translated_records_fx_rate_id_fx_rates")
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["consolidation_runs.id"],
            name=op.f("fk_translated_records_run_id_consolidation_runs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_translated_records")),
        sa.UniqueConstraint(
            "run_id",
            "canonical_record_id",
            name=op.f("uq_translated_records_run_id_canonical_record_id"),
        ),
    )
    op.create_index(
        op.f("ix_translated_records_run_id"), "translated_records", ["run_id"], unique=False
    )
    op.create_table(
        "journal_sources",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("journal_id", sa.UUID(), nullable=False),
        sa.Column("translated_record_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["journal_id"],
            ["adjustment_journals.id"],
            name=op.f("fk_journal_sources_journal_id_adjustment_journals"),
        ),
        sa.ForeignKeyConstraint(
            ["translated_record_id"],
            ["translated_records.id"],
            name=op.f("fk_journal_sources_translated_record_id_translated_records"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_journal_sources")),
        sa.UniqueConstraint(
            "journal_id",
            "translated_record_id",
            name=op.f("uq_journal_sources_journal_id_translated_record_id"),
        ),
    )
    op.create_table(
        "match_members",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("match_group_id", sa.UUID(), nullable=False),
        sa.Column("translated_record_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("side", sa.String(length=32), nullable=False),
        sa.Column("amount_group", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_match_members_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["match_group_id"],
            ["match_groups.id"],
            name=op.f("fk_match_members_match_group_id_match_groups"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["consolidation_runs.id"],
            name=op.f("fk_match_members_run_id_consolidation_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["translated_record_id"],
            ["translated_records.id"],
            name=op.f("fk_match_members_translated_record_id_translated_records"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_match_members")),
        sa.UniqueConstraint(
            "match_group_id",
            "translated_record_id",
            name=op.f("uq_match_members_match_group_id_translated_record_id"),
        ),
        sa.UniqueConstraint(
            "run_id",
            "translated_record_id",
            name=op.f("uq_match_members_run_id_translated_record_id"),
        ),
    )
    op.create_index(
        op.f("ix_match_members_match_group_id"), "match_members", ["match_group_id"], unique=False
    )

    # Append-only originals (AGENTS.md invariant): reject UPDATE/DELETE/TRUNCATE.
    op.execute(
        """
        CREATE FUNCTION kaikei_reject_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION '% is append-only: % rejected', TG_TABLE_NAME, TG_OP
                USING ERRCODE = 'integrity_constraint_violation';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    for table in ("source_files", "source_rows"):
        op.execute(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION kaikei_reject_mutation()"
        )
        op.execute(
            f"CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON {table} "
            "FOR EACH STATEMENT EXECUTE FUNCTION kaikei_reject_mutation()"
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP FUNCTION IF EXISTS kaikei_reject_mutation() CASCADE")
    op.drop_index(op.f("ix_match_members_match_group_id"), table_name="match_members")
    op.drop_table("match_members")
    op.drop_table("journal_sources")
    op.drop_index(op.f("ix_translated_records_run_id"), table_name="translated_records")
    op.drop_table("translated_records")
    op.drop_index(op.f("ix_finding_events_finding_id"), table_name="finding_events")
    op.drop_table("finding_events")
    op.drop_index(op.f("ix_adjustment_lines_journal_id"), table_name="adjustment_lines")
    op.drop_table("adjustment_lines")
    op.drop_index(op.f("ix_validation_findings_run_id"), table_name="validation_findings")
    op.drop_index(op.f("ix_validation_findings_rule_id"), table_name="validation_findings")
    op.drop_table("validation_findings")
    op.drop_index(op.f("ix_canonical_records_source_row_id"), table_name="canonical_records")
    op.drop_index(op.f("ix_canonical_records_company_id"), table_name="canonical_records")
    op.drop_table("canonical_records")
    op.drop_index(op.f("ix_adjustment_journals_run_id"), table_name="adjustment_journals")
    op.drop_table("adjustment_journals")
    op.drop_index(op.f("ix_source_rows_source_file_id"), table_name="source_rows")
    op.drop_table("source_rows")
    op.drop_index(op.f("ix_match_groups_run_id"), table_name="match_groups")
    op.drop_table("match_groups")
    op.drop_index(op.f("ix_consolidated_facts_run_id"), table_name="consolidated_facts")
    op.drop_table("consolidated_facts")
    op.drop_index(op.f("ix_account_mappings_company_id"), table_name="account_mappings")
    op.drop_table("account_mappings")
    op.drop_index(op.f("ix_source_files_company_id"), table_name="source_files")
    op.drop_table("source_files")
    op.drop_table("mapping_versions")
    op.drop_index(op.f("ix_fx_rates_rate_set_id"), table_name="fx_rates")
    op.drop_table("fx_rates")
    op.drop_index(op.f("ix_consolidation_runs_group_id"), table_name="consolidation_runs")
    op.drop_index(op.f("ix_consolidation_runs_fingerprint"), table_name="consolidation_runs")
    op.drop_table("consolidation_runs")
    op.drop_index(op.f("ix_company_aliases_company_id"), table_name="company_aliases")
    op.drop_table("company_aliases")
    op.drop_table("scenarios")
    op.drop_table("group_accounts")
    op.drop_table("fx_rate_sets")
    op.drop_index(op.f("ix_companies_group_id"), table_name="companies")
    op.drop_table("companies")
    op.drop_table("groups")
