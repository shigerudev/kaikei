"""Small builders for K4 findings: a deterministic id and the typed `observed` value."""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from decimal import Decimal, InvalidOperation
from typing import Any

from kaikei.domain.ingestion.models import SourceRef


def finding_id(rule_id: str, reason: str, source_refs: Sequence[SourceRef]) -> str:
    """Deterministic from rule + reason + source cells, so an identical rerun keeps the id
    (MANIFESTO: "same inputs -> same fingerprint and facts", AC10)."""
    raw = f"{rule_id}|{reason}|" + "|".join(f"{r.filename}:{r.row}:{r.column}" for r in source_refs)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def observed_fields(observed: str | Decimal | None) -> dict[str, Any]:
    """`Finding.observed` is a Decimal; anything that is not a number (an unknown account
    code, an unparseable cell) is kept verbatim in `context["observed"]` instead of dropped."""
    if observed is None:
        return {}
    if isinstance(observed, Decimal):
        return {"observed": observed}
    try:
        value = Decimal(observed)
    except InvalidOperation:
        return {"context": {"observed": observed}}
    if not value.is_finite():
        return {"context": {"observed": observed}}
    return {"observed": value}
