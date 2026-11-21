"""Minimal CSV ingestion adapter (MANIFESTO §4.1 ①).

Reads a file once, hashes the untouched bytes, and keeps every row keyed by its
header so later stages can always point back to filename + row + column.
"""

from __future__ import annotations

import csv
import hashlib
import io
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class SourceRow(BaseModel):
    """One ingested row, unparsed, keyed by its original column headers (MANIFESTO §4.1 ①)."""

    model_config = ConfigDict(extra="forbid")

    filename: str
    sha256: str
    sheet: str | None = None
    row: int = Field(ge=1)
    raw: dict[str, str]


def read_csv_rows(path: Path | str) -> tuple[str, list[SourceRow]]:
    """Returns (sha256 of the raw file, data rows). Row numbers are 1-indexed file lines."""
    path = Path(path)
    data = path.read_bytes()
    sha256 = hashlib.sha256(data).hexdigest()

    reader = csv.reader(io.StringIO(data.decode("utf-8-sig")))
    header = next(reader)

    rows: list[SourceRow] = []
    for row_number, fields in enumerate(reader, start=2):
        if not any(field.strip() for field in fields):
            continue
        raw = {column: (fields[i] if i < len(fields) else "") for i, column in enumerate(header)}
        rows.append(SourceRow(filename=path.name, sha256=sha256, row=row_number, raw=raw))
    return sha256, rows
