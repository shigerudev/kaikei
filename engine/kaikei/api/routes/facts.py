"""Fact lineage (MANIFESTO §4.4 `GET /facts/{fact_id}/lineage`, §3.2 screen 6 Inspector)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from kaikei.application import get_run
from kaikei.application.contracts import LineageOut
from kaikei.application.presentation import lineage_out

router = APIRouter(prefix="/api/v1", tags=["facts"])


@router.get("/facts/{fact_id}/lineage", response_model=LineageOut)
def get_lineage(fact_id: str) -> LineageOut:
    """Contributions (with source cell and its raw text), FX rate, journals, findings."""
    run_id = fact_id.split(":", 1)[0]
    record = get_run(run_id)
    published = lineage_out(record, fact_id) if record is not None else None
    if published is None:
        raise HTTPException(status_code=404, detail=f"fact {fact_id!r} not found")
    return published
