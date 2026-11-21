"""K4 Finding contract (SCOPE §2 K4, PLAN.md §9.2)."""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_serializer

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
    """
    Located rule result. Amounts are Decimal; JSON dump uses decimal strings.

    PLAN §9.2 uses expected_amount / observed_amount / discrepancy; we also accept
    the shorter expected / observed / difference aliases via field names below.
    """

    model_config = ConfigDict(extra="forbid")

    finding_id: str
    run_id: str | None = None
    rule_id: str
    rule_version: str
    severity: Severity
    status: FindingStatus = FindingStatus.OPEN
    source_refs: list[SourceRef] = Field(default_factory=list)
    affected_record_ids: list[str] = Field(default_factory=list)
    expected: Decimal | None = None
    observed: Decimal | None = None
    difference: Decimal | None = None
    currency: str | None = None
    reason: str
    reason_code: str | None = None
    reference: str | None = None  # fixture answer-key id (E01…E11c) when known
    context: dict[str, str] | None = None

    @field_serializer("expected", "observed", "difference")
    def _dec_str(self, v: Decimal | None) -> str | None:
        if v is None:
            return None
        return format(v, "f")
