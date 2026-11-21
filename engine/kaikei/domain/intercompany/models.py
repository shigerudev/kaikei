"""K5 MatchGroup / MatchMember contracts (SCOPE §2 K5)."""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MatchMode(StrEnum):
    TRANSACTION = "transaction"
    AGGREGATE = "aggregate"


class MatchStatus(StrEnum):
    MATCHED = "matched"
    MISMATCH = "mismatch"
    ONE_SIDED = "one_sided"
    UNMATCHED = "unmatched"


class MatchMember(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str
    company_id: str
    side: str  # "seller" | "buyer" | free label from policy
    amount_group: Decimal


class MatchGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_group_id: str
    run_id: str
    mode: MatchMode
    status: MatchStatus
    members: list[MatchMember] = Field(min_length=1)
    difference: Decimal
    tolerance: Decimal
    rule_version: str = "ic-v1"

    @model_validator(mode="after")
    def _status_consistency(self) -> MatchGroup:
        if self.status == MatchStatus.MATCHED and abs(self.difference) > self.tolerance:
            raise ValueError("MATCHED groups must have |difference| ≤ tolerance")
        return self
