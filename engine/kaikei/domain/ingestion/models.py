"""K2 SourceRef — physical evidence for every value (SCOPE §2 K2, MANIFESTO §4.2)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SourceRef(BaseModel):
    """End of every lineage: file + sheet + row + column (+ optional cell label)."""

    model_config = ConfigDict(extra="forbid")

    file_id: str | None = None
    filename: str
    sheet: str | None = None
    row: int | None = Field(default=None, ge=1)
    column: str | None = None
    cell: str | None = None
    raw: str | None = None
