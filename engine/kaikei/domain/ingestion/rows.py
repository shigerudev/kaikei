"""Raw ingestion outputs: SourceRow / SourceCell / IngestResult (K2 source layer)."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.validation.models import Finding


@dataclass(frozen=True)
class SourceCell:
    """One raw value with its evidence. Blank -> value None, raw ""; never zero."""

    ref: SourceRef
    raw: str
    value: Decimal | str | None = None
    flags: tuple[str, ...] = ()


@dataclass
class SourceRow:
    row: int  # 1-based physical line in the file (spreadsheet-style row number)
    kind: str  # data | subtotal | section | note | blank
    cells: dict[str, SourceCell]  # keyed by original header (all columns kept)
    roles: dict[str, str] = field(default_factory=dict)  # role -> header
    period: str | None = None  # YYYY-MM when row-level
    period_by_column: dict[str, str | None] = field(default_factory=dict)  # wide formats
    block: str | None = None  # stacked-block id (wide)
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class PreambleLine:
    row: int
    text: str


@dataclass(frozen=True)
class IngestHint:
    """Per-company configuration. Everything optional; structure detection fills the rest."""

    adapter: str | None = None  # long | wide | debit_credit
    numeric_locale: str | None = None  # es_GT, es_ES, en_US, decimal_comma ...
    delimiter: str | None = None
    default_year: int | None = None  # wide headers with month labels only
    currency: str | None = None  # row currency for money checks (ISO 4217)
    preamble_prefixes: tuple[str, ...] = ("#",)
    note_prefixes: tuple[str, ...] = ("nota",)
    subtotal_prefixes: tuple[str, ...] = ("total", "subtotal", "utilidad", "resultado")


@dataclass
class IngestResult:
    filename: str
    sha256: str
    size: int
    encoding: str | None = None
    delimiter: str | None = None
    adapter: str | None = None
    numeric_locale: str | None = None
    preamble: list[PreambleLine] = field(default_factory=list)
    header_rows: list[int] = field(default_factory=list)
    headers: list[str] = field(default_factory=list)
    header_currency: str | None = None
    rows: list[SourceRow] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)

    @property
    def accepted(self) -> bool:
        return not any(f.rule_id == "PARSER-008" for f in self.findings)
