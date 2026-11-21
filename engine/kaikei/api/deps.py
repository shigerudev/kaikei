"""Shared lookups for the routers: resolve a group or a run, or answer 404."""

from __future__ import annotations

from fastapi import HTTPException

from kaikei.application import RunRecord, get_run
from kaikei.application.group_config import GroupMeta, get_group


def group_or_404(group_id: str) -> GroupMeta:
    group = get_group(group_id)
    if group is None:
        raise HTTPException(status_code=404, detail=f"group {group_id!r} not found")
    return group


def run_or_404(run_id: str) -> RunRecord:
    record = get_run(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"run {run_id!r} not found")
    return record
