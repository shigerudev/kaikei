"""Upload use case: validate, hash, store the original byte-for-byte, record it in source_files."""

from __future__ import annotations

import hashlib
import re
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import PurePosixPath

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kaikei.domain.ingestion import IngestHint, IngestResult, ingest_file
from kaikei.domain.validation.models import Severity
from kaikei.infrastructure.db.models import (
    Company,
    CompanyAlias,
    Group,
    SourceFile,
    SourceRow,
    ValidationFinding,
)
from kaikei.infrastructure.storage import ObjectStore

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # matches the UI dropzone cap
ALLOWED_EXTENSIONS = (".csv",)


class UploadError(Exception):
    """A client-side problem; `status` is the HTTP code the API maps it to."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass(frozen=True)
class UploadResult:
    file: SourceFile
    already_imported: bool


def normalize_alias(text: str) -> str:
    """Casefold, strip accents and non-alphanumerics (shared with the seed script)."""
    folded = unicodedata.normalize("NFKD", text).casefold()
    stripped = "".join(c for c in folded if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", stripped).strip()


def parse_group_id(group_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(group_id)
    except (ValueError, AttributeError, TypeError):
        raise UploadError(404, f"group {group_id!r} not found") from None


def resolve_group_uuid(session: Session, group_id: str) -> uuid.UUID:
    from kaikei.application.group_service import ConfigError, get_group_row

    try:
        return get_group_row(session, group_id).id
    except ConfigError as err:
        raise UploadError(err.status, err.message) from err


def _safe_name(filename: str) -> str:
    name = PurePosixPath((filename or "").replace("\\", "/")).name
    return name


def validate_upload(filename: str, data: bytes) -> str:
    """Return the sanitised filename or raise UploadError (400 / 413 / 422)."""
    name = _safe_name(filename)
    if not name or "\x00" in name:
        raise UploadError(400, "file has no usable name")
    ext = PurePosixPath(name).suffix.lower()
    if ext == ".xlsx":
        raise UploadError(
            415,
            "XLSX is not supported in this build; upload a CSV (long, debit_credit, or wide)",
        )
    if ext not in ALLOWED_EXTENSIONS:
        raise UploadError(400, f"unsupported file type {ext or '(none)'}; use .csv")
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadError(413, f"file exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit")
    if not data:
        raise UploadError(400, "file is empty")
    if ext == ".csv" and b"\x00" in data:
        raise UploadError(422, "CSV contains NUL bytes; it is not a text file")
    return name


def resolve_company_id(session: Session, group_id: uuid.UUID, filename: str) -> uuid.UUID | None:
    """Exact match of the filename stem against the group's configured aliases. Never guesses."""
    stem = normalize_alias(PurePosixPath(filename).stem)
    if not stem:
        return None
    ids = set(
        session.scalars(
            select(CompanyAlias.company_id).where(
                CompanyAlias.group_id == group_id, CompanyAlias.alias_normalized == stem
            )
        )
    )
    return ids.pop() if len(ids) == 1 else None


def _find(session: Session, group_id: uuid.UUID, sha256: str) -> SourceFile | None:
    return session.scalar(
        select(SourceFile).where(SourceFile.group_id == group_id, SourceFile.sha256 == sha256)
    )


def _resolve_company(
    session: Session, group_id: uuid.UUID, filename: str, company_id: str | None
) -> uuid.UUID | None:
    if company_id:
        try:
            cid = uuid.UUID(company_id)
        except (ValueError, AttributeError, TypeError):
            row = session.scalar(
                select(Company).where(Company.group_id == group_id, Company.code == company_id)
            )
            return None if row is None else row.id
        row = session.get(Company, cid)
        if row is None or row.group_id != group_id:
            raise UploadError(404, f"company {company_id!r} not found in this group")
        return row.id
    return resolve_company_id(session, group_id, filename)


def upload_file(
    session: Session,
    store: ObjectStore,
    group_id: str,
    filename: str,
    data: bytes,
    *,
    company_id: str | None = None,
) -> UploadResult:
    name = validate_upload(filename, data)
    gid = resolve_group_uuid(session, group_id)
    if session.get(Group, gid) is None:
        raise UploadError(404, f"group {group_id!r} not found")

    sha256 = hashlib.sha256(data).hexdigest()
    existing = _find(session, gid, sha256)
    if existing is not None:
        return UploadResult(existing, True)

    resolved = _resolve_company(session, gid, name, company_id)
    ingested = _ingest(session, resolved, name, data)
    if ingested is not None:
        blockers = [f for f in ingested.findings if f.severity == Severity.BLOCKER]
        if blockers:  # MANIFESTO §4.1: unsafe or unreadable file -> reject it, store nothing
            raise UploadError(422, "; ".join(f"{f.rule_id}: {f.reason}" for f in blockers))
    uri = store.put(str(gid), sha256, name, data)
    row = SourceFile(
        group_id=gid, company_id=resolved, filename=name, sha256=sha256, stored_uri=uri
    )
    session.add(row)
    try:
        session.flush()
    except IntegrityError:  # concurrent identical upload won the race
        session.rollback()
        existing = _find(session, gid, sha256)
        if existing is None:
            raise
        return UploadResult(existing, True)
    if ingested is not None:
        _persist_ingest(session, row, ingested)
    session.commit()
    session.refresh(row)
    return UploadResult(row, False)


def _ingest(
    session: Session, company_id: uuid.UUID | None, name: str, data: bytes
) -> IngestResult | None:
    """Parse with the CSV adapters. XLSX raises NotImplementedError (owner: Jose)."""
    company = session.get(Company, company_id) if company_id else None
    hint = IngestHint(currency=company.functional_currency) if company else None
    try:
        return ingest_file(name, data, hint=hint, max_bytes=MAX_UPLOAD_BYTES)
    except NotImplementedError:
        raise  # XLSX adapter (owner: Jose) — callers map this to HTTP 415


def _persist_ingest(session: Session, file: SourceFile, result: IngestResult) -> None:
    """Raw rows (every cell with its coordinate) and located ingestion findings."""
    by_line: dict[int, SourceRow] = {}
    for r in result.rows:
        db_row = SourceRow(
            source_file_id=file.id,
            sheet="",
            row_number=r.row,
            raw={
                "kind": r.kind,
                "cells": {h: c.raw for h, c in r.cells.items()},
                "roles": r.roles,
                "period": r.period,
                "period_by_column": r.period_by_column,
                "block": r.block,
                "flags": list(r.flags),
            },
            cell_refs={h: c.ref.cell for h, c in r.cells.items() if c.ref.cell},
        )
        session.add(db_row)
        by_line[r.row] = db_row
    session.flush()
    for f in result.findings:
        ref = f.source_refs[0] if f.source_refs else None
        line = by_line.get(ref.row) if ref and ref.row else None
        session.add(
            ValidationFinding(
                rule_id=f.rule_id,
                rule_version=f.rule_version,
                severity=f.severity.value,
                status=f.status.value,
                source_row_id=line.id if line else None,
                source_cell=ref.cell if ref else None,
                affected_record_ids=[],
                expected=f.expected,
                observed=f.observed,
                difference=f.difference,
                currency=f.currency,
                reason=f.reason,
                reason_code=f.reason_code,
                context={**(f.context or {}), "stage": "ingest", "source_file_id": str(file.id)},
            )
        )
