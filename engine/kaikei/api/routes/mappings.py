"""Mapping approval (MANIFESTO §4.4 `POST /api/v1/mappings/{id}/approve`, §4.1 ② Normalize).

The reviewer confirms each company's account mapping before a run uses it. The mapping id is
`{group_id}:{company_id}` — the same reference `lib/api/` sends.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from kaikei.api.deps import group_or_404
from kaikei.application.contracts import SourceFileOut
from kaikei.application.sources import approve_mapping

router = APIRouter(prefix="/api/v1", tags=["mappings"])


@router.post("/mappings/{mapping_id}/approve", response_model=SourceFileOut)
def approve(mapping_id: str) -> SourceFileOut:
    """Freeze the mapping version for one company's pack.

    Approval records the reviewer's confirmation. The run then uses the latest
    mapping-approved pack for each company.
    """
    group_id, _, company_id = mapping_id.partition(":")
    if not company_id:
        raise HTTPException(status_code=422, detail="mapping id must be '{group_id}:{company_id}'")
    group = group_or_404(group_id)
    try:
        return approve_mapping(group.id, company_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"no stored pack for company {company_id!r}; upload it first",
        ) from exc
