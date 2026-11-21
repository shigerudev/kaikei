"""Declarative base, naming convention and shared column types (K1, MANIFESTO §4.2)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from sqlalchemy import CHAR, DateTime, MetaData, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, mapped_column

# Deterministic constraint names keep Alembic autogenerate/downgrade stable.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Money NUMERIC(20,4), rates NUMERIC(20,10). Never Float.
MONEY = Numeric(20, 4, asdecimal=True)
RATE = Numeric(20, 10, asdecimal=True)

# Annotated types used with Mapped[...].
uuid_pk = Annotated[
    uuid.UUID,
    mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
]
money = Annotated[Decimal, mapped_column(MONEY)]
rate = Annotated[Decimal, mapped_column(RATE)]
ccy = Annotated[str, mapped_column(CHAR(3))]  # ISO-4217 alphabetic code
period_str = Annotated[str, mapped_column(String(7))]  # YYYY or YYYY-MM
created_ts = Annotated[datetime, mapped_column(DateTime(timezone=True), server_default=func.now())]


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {dict[str, Any]: JSONB, list[Any]: JSONB}


def in_check(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"
