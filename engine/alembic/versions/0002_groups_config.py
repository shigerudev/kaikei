"""groups config: slug, company code, parameters, versioned rate sets

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-21 17:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("slug", sa.String(length=80), nullable=True))
    op.execute(
        sa.text(
            "UPDATE groups SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) "
            "WHERE slug IS NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE groups SET slug = concat(slug, '-', substr(id::text, 1, 8)) "
            "WHERE id IN ("
            "  SELECT id FROM ("
            "    SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn "
            "    FROM groups"
            "  ) d WHERE rn > 1"
            ")"
        )
    )
    op.alter_column("groups", "slug", existing_type=sa.String(length=80), nullable=False)
    op.create_unique_constraint(op.f("uq_groups_slug"), "groups", ["slug"])

    op.add_column("companies", sa.Column("code", sa.String(length=64), nullable=True))
    op.execute(
        sa.text(
            "UPDATE companies SET code = upper(left(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'), 64)) WHERE code IS NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE companies SET code = concat(code, '-', substr(id::text, 1, 8)) "
            "WHERE id IN ("
            "  SELECT id FROM ("
            "    SELECT id, row_number() OVER (PARTITION BY group_id, code ORDER BY name) AS rn "
            "    FROM companies"
            "  ) d WHERE rn > 1"
            ")"
        )
    )
    op.alter_column("companies", "code", existing_type=sa.String(length=64), nullable=False)
    op.create_unique_constraint(
        op.f("uq_companies_group_id_code"), "companies", ["group_id", "code"]
    )
    op.add_column("companies", sa.Column("pack_filename", sa.String(length=512), nullable=True))
    op.add_column("companies", sa.Column("layout_note", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ownership_pct",
        "companies",
        "ownership_pct >= 0 AND ownership_pct <= 100",
    )

    op.create_table(
        "group_parameters",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.Column("parameter", sa.String(length=64), nullable=False),
        sa.Column("scope", sa.String(length=64), nullable=False),
        sa.Column("value", sa.String(length=200), nullable=False),
        sa.Column("unit", sa.String(length=64), nullable=False),
        sa.Column("used_for", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=200), nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_group_parameters_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_parameters")),
        sa.UniqueConstraint(
            "group_id",
            "parameter",
            "scope",
            name=op.f("uq_group_parameters_group_id_parameter_scope"),
        ),
    )
    op.create_index(
        op.f("ix_group_parameters_group_id"), "group_parameters", ["group_id"], unique=False
    )

    op.add_column(
        "fx_rate_sets", sa.Column("version", sa.Integer(), server_default="1", nullable=False)
    )
    op.drop_constraint(op.f("uq_fx_rate_sets_group_id_name"), "fx_rate_sets", type_="unique")
    op.create_unique_constraint(
        op.f("uq_fx_rate_sets_group_id_version"), "fx_rate_sets", ["group_id", "version"]
    )

    op.alter_column(
        "fx_rates",
        "period",
        existing_type=sa.String(length=7),
        type_=sa.String(length=10),
        existing_nullable=False,
    )
    op.drop_constraint(op.f("ck_fx_rates_period_shape"), "fx_rates", type_="check")
    op.create_check_constraint(
        "period_shape",
        "fx_rates",
        "period ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'",
    )
    op.add_column(
        "fx_rates", sa.Column("units_per_usd", sa.Numeric(precision=20, scale=10), nullable=True)
    )
    op.add_column(
        "fx_rates",
        sa.Column("applies_to", sa.String(length=200), server_default="", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("fx_rates", "applies_to")
    op.drop_column("fx_rates", "units_per_usd")
    op.drop_constraint(op.f("ck_fx_rates_period_shape"), "fx_rates", type_="check")
    op.create_check_constraint("period_shape", "fx_rates", "period ~ '^[0-9]{4}(-[0-9]{2})?$'")
    op.alter_column(
        "fx_rates",
        "period",
        existing_type=sa.String(length=10),
        type_=sa.String(length=7),
        existing_nullable=False,
    )
    op.drop_constraint(op.f("uq_fx_rate_sets_group_id_version"), "fx_rate_sets", type_="unique")
    op.create_unique_constraint(
        op.f("uq_fx_rate_sets_group_id_name"), "fx_rate_sets", ["group_id", "name"]
    )
    op.drop_column("fx_rate_sets", "version")
    op.drop_index(op.f("ix_group_parameters_group_id"), table_name="group_parameters")
    op.drop_table("group_parameters")
    op.drop_constraint("ck_companies_ownership_pct", "companies", type_="check")
    op.drop_column("companies", "layout_note")
    op.drop_column("companies", "pack_filename")
    op.drop_constraint(op.f("uq_companies_group_id_code"), "companies", type_="unique")
    op.drop_column("companies", "code")
    op.drop_constraint(op.f("uq_groups_slug"), "groups", type_="unique")
    op.drop_column("groups", "slug")
