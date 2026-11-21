"""Consolidation runs (MANIFESTO §4.4, SCOPE §2 K6/K8) — happy-path slice.

`POST /consolidations` runs the fixture pack slice `kaikei.application.pipeline` documents
(EMP1 + EMP2, with its exact scope cuts). The body names the group and why the run exists;
both are optional so a bare POST still starts a run on the default group.

`GET /consolidations/{run_id}/facts` serves the whole statement for one period: posted lines
plus the subtotals and totals from the group chart of accounts, so the reviewer screen renders
figures the engine computed and never adds any up itself.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from kaikei.api.deps import group_or_404, run_or_404
from kaikei.application import (
    PublicationBlockedError,
    RunRecord,
    UnknownGroupError,
    list_runs,
    publish_run,
    run_consolidation,
)
from kaikei.application.contracts import (
    FactsOut,
    FindingOut,
    ReconciliationsOut,
    RunOut,
    StartRunRequest,
)
from kaikei.application.group_config import default_group_id
from kaikei.application.presentation import (
    findings_out,
    reconciliations_out,
    run_out,
    runs_out,
    statement_out,
)
from kaikei.domain.normalization.models import Statement

router = APIRouter(prefix="/api/v1", tags=["consolidations"])


@router.get("/consolidations", response_model=list[RunOut])
def list_consolidations(group_id: str | None = Query(default=None)) -> list[RunOut]:
    """Every run for a group, newest first. Published runs are never overwritten."""
    group = group_or_404(group_id or default_group_id() or "")
    return runs_out(list_runs(group.id))


@router.post("/consolidations", response_model=RunOut, status_code=201)
def create_consolidation(body: StartRunRequest | None = None) -> RunOut:
    """Start a run on the group's packs (this slice: EMP1 + EMP2)."""
    request = body or StartRunRequest()
    group = group_or_404(request.group_id or default_group_id() or "")
    try:
        record = run_consolidation(group_id=group.id, reason=request.reason)
    except UnknownGroupError as exc:  # pragma: no cover - group_or_404 already guards this
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return run_out(record)


@router.get("/consolidations/{run_id}", response_model=RunOut)
def get_consolidation(run_id: str) -> RunOut:
    """Status, fingerprint, stages, pinned inputs and counts (MANIFESTO §4.4)."""
    return run_out(run_or_404(run_id))


@router.get("/consolidations/{run_id}/facts", response_model=FactsOut)
def get_facts(
    run_id: str,
    period: str | None = Query(default=None),
    statement: str = Query(default=Statement.PL.value),
) -> FactsOut:
    """One statement for one reporting period.

    `period` defaults to the group's fiscal year. A balance sheet is always reported at its
    closing period (MANIFESTO §4.2), whatever period is asked for.
    """
    record: RunRecord = run_or_404(run_id)
    group = group_or_404(record.group_id)
    try:
        wanted = Statement(statement.upper())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="statement must be PL or BS") from exc
    return statement_out(record, period=period or group.fiscal_year, statement=wanted)


@router.get("/consolidations/{run_id}/findings", response_model=list[FindingOut])
def get_findings(run_id: str) -> list[FindingOut]:
    """Every finding raised for the run, each still carrying its located source cells."""
    return findings_out(run_or_404(run_id))


@router.get("/consolidations/{run_id}/reconciliations", response_model=ReconciliationsOut)
def get_reconciliations(run_id: str) -> ReconciliationsOut:
    """IC matches (matched/mismatch/one-sided) and their elimination journals."""
    return reconciliations_out(run_or_404(run_id))


@router.post("/consolidations/{run_id}/publish", response_model=RunOut)
def publish(run_id: str) -> RunOut:
    """Freeze the run, refusing while an OPEN BLOCKER remains (MANIFESTO §4.1 gate ⑦)."""
    run_or_404(run_id)
    try:
        record = publish_run(run_id)
    except PublicationBlockedError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": str(exc),
                "open_blocker_ids": [f.id for f in exc.open_blockers],
            },
        ) from exc
    return run_out(record)
