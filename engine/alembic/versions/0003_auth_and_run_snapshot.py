"""users, memberships, sessions, MCP tokens, run snapshots

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-21 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("consolidation_runs", sa.Column("snapshot", postgresql.JSONB(), nullable=True))

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("password_salt", sa.LargeBinary(), nullable=False),
        sa.Column("password_hash", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "memberships",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("role IN ('owner', 'member')", name="membership_role"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_memberships_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_memberships_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_memberships")),
        sa.UniqueConstraint("user_id", "group_id", name=op.f("uq_memberships_user_id_group_id")),
    )
    op.create_index(op.f("ix_memberships_user_id"), "memberships", ["user_id"])
    op.create_index(op.f("ix_memberships_group_id"), "memberships", ["group_id"])
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_auth_sessions_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_auth_sessions_token_hash")),
    )
    op.create_index(op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"])
    op.create_table(
        "group_mcp_tokens",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name=op.f("fk_group_mcp_tokens_group_id_groups")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_mcp_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_group_mcp_tokens_token_hash")),
    )
    op.create_index(op.f("ix_group_mcp_tokens_group_id"), "group_mcp_tokens", ["group_id"])


def downgrade() -> None:
    op.drop_table("group_mcp_tokens")
    op.drop_table("auth_sessions")
    op.drop_table("memberships")
    op.drop_table("users")
    op.drop_column("consolidation_runs", "snapshot")
