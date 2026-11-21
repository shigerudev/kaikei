"""Mapping types for the "long" CSV layout the happy-path slice normalizes.

K3's contract (`StructuralMapping` / `AccountMapping` / `MappingConfig` in `models.py`) models
the general case; this slice only needs a column layout and a local -> group account table
with the statement each account belongs to, so it keeps its own small types.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, model_validator

from kaikei.domain.normalization.models import Statement


class LongAccount(BaseModel):
    """Local account code -> group account (PLAN §6.3), trimmed to what normalize() needs."""

    model_config = ConfigDict(extra="forbid")

    local_code: str
    group_account_code: str
    statement: Statement


class LongLayout(BaseModel):
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


class LongMapping(BaseModel):
    """Layout + account table for one company."""

    model_config = ConfigDict(extra="forbid")

    structural: LongLayout
    accounts: dict[str, LongAccount]

    @model_validator(mode="after")
    def _accounts_key_matches_local_code(self) -> LongMapping:
        for local_code, mapping in self.accounts.items():
            if mapping.local_code != local_code:
                raise ValueError(f"accounts[{local_code!r}].local_code == {mapping.local_code!r}")
        return self
