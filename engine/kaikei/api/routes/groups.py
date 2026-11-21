"""Group configuration (MANIFESTO §2 "Group configuration", §4.4).

Read-only. The pinned rate set, parameters and search come from the group's own data files;
nothing on these routes computes a figure. `GET /groups/{id}` and `/companies` are served by
the DB-backed `files` router.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from kaikei.api.deps import group_or_404
from kaikei.application import latest_run, list_runs
from kaikei.application.contracts import (
    ParameterOut,
    RateSetOut,
    SearchHitOut,
)
from kaikei.application.presentation import (
    parameters_out,
    rate_set_out,
    runs_out,
    search_out,
)
from kaikei.application.sources import list_files

router = APIRouter(prefix="/api/v1", tags=["groups"])


@router.get("/groups/{group_id}/fx-rate-sets/current", response_model=RateSetOut)
def get_current_rate_set(group_id: str) -> RateSetOut:
    """The pinned rate set every run translates with (MANIFESTO §4.2 FX policy)."""
    group = group_or_404(group_id)
    return rate_set_out(group.id)


@router.get("/groups/{group_id}/parameters", response_model=list[ParameterOut])
def get_parameters(group_id: str) -> list[ParameterOut]:
    """Group parameters (IC tolerance, WACC, tax rates) as configured, with their source."""
    group = group_or_404(group_id)
    return parameters_out(group.id)


@router.get("/groups/{group_id}/search", response_model=list[SearchHitOut])
def search(group_id: str, q: str = Query(min_length=0)) -> list[SearchHitOut]:
    """Companies, statement lines, findings, files and runs matching a typed query."""
    group = group_or_404(group_id)
    record = latest_run(group.id)
    return search_out(
        group.id,
        q,
        record,
        files=list_files(group.id, record),
        runs=runs_out(list_runs(group.id)),
    )
