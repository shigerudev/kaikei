"""K2 SourceRef + SourceRow — physical evidence for every value (SCOPE §2 K2, MANIFESTO §4.2)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SourceRef(BaseModel):
    """End of every lineage trail: the exact file, row and column a value came from."""

    model_config = ConfigDict(extra="forbid")

    filename: str
    sheet: str | None = None
    row: int = Field(ge=1)
    column: str
    cell: str | None = None


class SourceRow(BaseModel):
    """One ingested row, unparsed, keyed by its original column headers (MANIFESTO §4.1 ①)."""

    model_config = ConfigDict(extra="forbid")

    filename: str
    sha256: str
    sheet: str | None = None
    row: int = Field(ge=1)
    raw: dict[str, str]
