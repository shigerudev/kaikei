"""Ingestion domain (Jose / K2 source layer)."""

from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.ingestion.numbers import (
    DecimalParse,
    MoneyParse,
    month_from_label,
    parse_date,
    parse_decimal,
    parse_decimal_ex,
    parse_money,
    parse_period,
)
from kaikei.domain.ingestion.rows import (
    IngestHint,
    IngestResult,
    PreambleLine,
    SourceCell,
    SourceRow,
)
from kaikei.domain.ingestion.safety import check_file, sha256_bytes
from kaikei.domain.ingestion.service import ingest_file

__all__ = [
    "DecimalParse",
    "IngestHint",
    "IngestResult",
    "MoneyParse",
    "PreambleLine",
    "SourceCell",
    "SourceRef",
    "SourceRow",
    "check_file",
    "ingest_file",
    "month_from_label",
    "parse_date",
    "parse_decimal",
    "parse_decimal_ex",
    "parse_money",
    "parse_period",
    "sha256_bytes",
]
