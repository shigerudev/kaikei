"""K4 Finding contract (SCOPE §2 K4, PLAN.md §9.2) — minimal shape for the happy-path slice."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from kaikei.domain.ingestion.models import SourceRef


class Severity(StrEnum):
    BLOCKER = "BLOCKER"
    WARNING = "WARNING"
    INFO = "INFO"


class FindingStatus(StrEnum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    ACCEPTED_RISK = "ACCEPTED_RISK"
    SUPERSEDED = "SUPERSEDED"


class Finding(BaseModel):
    """A located rule result. Every finding traces back to the source cell(s) it came from."""

    model_config = ConfigDict(extra="forbid")

    rule_id: str
    rule_version: str
    severity: Severity
    status: FindingStatus = FindingStatus.OPEN
    source_refs: list[SourceRef]
    observed: str | None = None
    reason: str
