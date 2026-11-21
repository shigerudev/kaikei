"""Finding decisions (MANIFESTO §4.4 `POST /api/v1/findings/{id}/decisions`).

A decision never edits a run: runs are immutable, so resolving or accepting a finding starts
a new one, pinned to the decision. The reason is required — an unexplained decision isn't
auditable.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from kaikei.api.deps import group_or_404
from kaikei.application import decide_finding
from kaikei.application.contracts import DecisionRequest, RunOut
from kaikei.application.group_config import default_group_id
from kaikei.application.presentation import run_out

router = APIRouter(prefix="/api/v1", tags=["findings"])


@router.post("/findings/{finding_id}/decisions", response_model=RunOut, status_code=201)
def decide(
    finding_id: str,
    body: DecisionRequest,
    group_id: str | None = Query(default=None),
) -> RunOut:
    """Record the decision and return the new run it produced."""
    group = group_or_404(group_id or default_group_id() or "")
    try:
        record = decide_finding(
            finding_id,
            action=body.action,
            reason=body.reason,
            actor=body.actor,
            group_id=group.id,
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"finding {finding_id!r} is not in this group's latest run",
        ) from exc
    return run_out(record)
