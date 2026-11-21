"""K2 CanonicalRecord + K3 mapping config (SCOPE §2, MANIFESTO §4.2) — minimal happy-path shape."""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, field_serializer, model_validator

from kaikei.domain.ingestion.models import SourceRef


class Statement(StrEnum):
    PL = "PL"
    BS = "BS"


class AccountMapping(BaseModel):
    """Local account code -> group account (PLAN §6.3), trimmed to what normalize() needs."""

    model_config = ConfigDict(extra="forbid")

    local_code: str
    group_account_code: str
    statement: Statement


class StructuralMapping(BaseModel):
    """Per-company column layout for one "long" format file (PLAN §6.2)."""

    model_config = ConfigDict(extra="forbid")

    mapping_version: str
    company_id: str
    period_column: str
    account_column: str
    description_column: str
    amount_column: str
    scenario_column: str
    currency: str
    scenario_map: dict[str, str] = {}


class MappingConfig(BaseModel):
    """Bundle normalize() needs for one company: layout + its account mapping table."""

    model_config = ConfigDict(extra="forbid")

    structural: StructuralMapping
    accounts: dict[str, AccountMapping]

    @model_validator(mode="after")
    def _accounts_key_matches_local_code(self) -> MappingConfig:
        for local_code, mapping in self.accounts.items():
            if mapping.local_code != local_code:
                raise ValueError(f"accounts[{local_code!r}].local_code == {mapping.local_code!r}")
        return self


class CanonicalRecord(BaseModel):
    """One company + group account + period + amount + source cell (MANIFESTO §4.2)."""

    model_config = ConfigDict(extra="forbid")

    source: SourceRef
    company_id: str
    scenario_id: str
    period: str
    statement: Statement
    group_account_code: str
    local_account_code: str
    description: str
    amount_local: Decimal
    currency: str
    mapping_version: str

    @field_serializer("amount_local")
    def _amount_as_string(self, v: Decimal) -> str:
        return format(v, "f")
