"""Save and restore RunRecord snapshots so a restart still serves facts and findings."""

from __future__ import annotations

import uuid
from dataclasses import asdict, is_dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from kaikei.application.contracts import RunOut
from kaikei.application.group_config import _try_session
from kaikei.application.group_service import ConfigError, get_group_row
from kaikei.application.models import ConsolidatedFact
from kaikei.application.pipeline import (
    RUN_ORDER,
    RUNS,
    FindingRecord,
    MatchInfo,
    RunRecord,
)
from kaikei.domain.consolidation.models import Journal
from kaikei.domain.intercompany.models import MatchGroup
from kaikei.domain.lineage import Lineage
from kaikei.domain.normalization.models import CanonicalRecord
from kaikei.infrastructure.db import models


def _dump(obj: Any) -> Any:
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, Decimal):
        return format(obj, "f")
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Enum):
        return obj.value
    if hasattr(obj, "model_dump"):
        return _dump(obj.model_dump(mode="json"))
    if is_dataclass(obj) and not isinstance(obj, type):
        return _dump(asdict(obj))
    if isinstance(obj, dict):
        return {str(k): _dump(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_dump(v) for v in obj]
    return obj


def save_run(record: RunRecord) -> None:
    session = _try_session()
    if session is None:
        return
    try:
        from sqlalchemy import select

        group = get_group_row(session, record.group_id)
        scenario_row = session.scalar(
            select(models.Scenario)
            .where(models.Scenario.group_id == group.id)
            .order_by(models.Scenario.code)
        )
        rate = session.scalar(
            select(models.FxRateSet)
            .where(models.FxRateSet.group_id == group.id)
            .order_by(models.FxRateSet.version.desc())
        )
        if scenario_row is None or rate is None:
            return
        try:
            run_uuid = uuid.UUID(record.run.id)
        except ValueError:
            run_uuid = uuid.uuid4()
        payload = {
            "run": _dump(record.run),
            "group_id": record.group_id,
            "findings": [_dump(f) for f in record.findings],
            "facts": [_dump(f) for f in record.facts],
            "records": {k: _dump(v) for k, v in record.records.items()},
            "matches": [_dump(m) for m in record.matches],
            "journals": [_dump(j) for j in record.journals],
            "lineages": {k: _dump(v) for k, v in record.lineages.items()},
            "match_info": {k: _dump(v) for k, v in record.match_info.items()},
            "files": list(record.files),
            "raw_cells": {f"{a}|{b}|{c}": v for (a, b, c), v in record.raw_cells.items()},
        }
        existing = session.get(models.ConsolidationRun, run_uuid)
        if existing is None:
            session.add(
                models.ConsolidationRun(
                    id=run_uuid,
                    group_id=group.id,
                    scenario_id=scenario_row.id,
                    rate_set_id=rate.id,
                    rule_set_version=record.run.inputs.rule_set_version,
                    mapping_version=record.run.inputs.mapping_version,
                    fingerprint=record.run.fingerprint,
                    status=record.run.status,
                    inputs=record.run.inputs.model_dump(mode="json"),
                    snapshot=payload,
                )
            )
        else:
            existing.status = record.run.status
            existing.snapshot = payload
        session.commit()
    except (ConfigError, Exception):
        session.rollback()
    finally:
        session.close()


def _load_record(payload: dict[str, Any]) -> RunRecord:
    raw_cells = {}
    for key, value in (payload.get("raw_cells") or {}).items():
        parts = str(key).split("|", 2)
        if len(parts) == 3:
            raw_cells[(parts[0], int(parts[1]), parts[2])] = value
    match_info = {
        k: MatchInfo(**v) if isinstance(v, dict) else v
        for k, v in (payload.get("match_info") or {}).items()
    }
    return RunRecord(
        run=RunOut.model_validate(payload["run"]),
        group_id=payload["group_id"],
        findings=[FindingRecord.model_validate(f) for f in payload.get("findings") or []],
        facts=[ConsolidatedFact.model_validate(f) for f in payload.get("facts") or []],
        lineages={k: Lineage.model_validate(v) for k, v in (payload.get("lineages") or {}).items()},
        matches=[MatchGroup.model_validate(m) for m in payload.get("matches") or []],
        journals=[Journal.model_validate(j) for j in payload.get("journals") or []],
        records={
            k: CanonicalRecord.model_validate(v) for k, v in (payload.get("records") or {}).items()
        },
        raw_cells=raw_cells,
        match_info=match_info,
        files=tuple(tuple(row) for row in payload.get("files") or ()),
    )


def hydrate_runs(group_id: str) -> None:
    if RUN_ORDER.get(group_id):
        return
    session = _try_session()
    if session is None:
        return
    try:
        from sqlalchemy import select

        group = get_group_row(session, group_id)
        rows = session.scalars(
            select(models.ConsolidationRun)
            .where(models.ConsolidationRun.group_id == group.id)
            .order_by(models.ConsolidationRun.created_at)
        )
        order: list[str] = []
        for row in rows:
            if not row.snapshot:
                continue
            record = _load_record(row.snapshot)
            RUNS[record.run.id] = record
            order.append(record.run.id)
        if order:
            RUN_ORDER[group_id] = order
    except (ConfigError, Exception):
        return
    finally:
        session.close()
