"""Stored originals and their parsed preview (`/files`, MANIFESTO §4.4, §4.1 ①).

One pack per company. Each file is identified by the SHA-256 of its untouched bytes, so the
same hash in the same group is "already imported" rather than a second import (§4.1 ①), and
nothing here ever rewrites a stored original (MANIFESTO principle 2).

Scope cut, stated plainly: the group's packs live in its data directory and are registered
from there at first read — they *are* the stored originals for this build. An upload of one
of them is recognised by hash; an upload of a file this build has no layout for is refused
with a reason rather than accepted and silently left unparsed. A pack's `status` is
`MAPPING_APPROVED` only once a mapping has been approved for it, which for now means the
packs `pipeline._INGEST` normalizes.

TODO(Jo): K1 gives `source_files` / `source_rows` (append-only) and K2/K3 the layout
detection an arbitrary upload needs. Until then this registry is the storage boundary.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from kaikei.application import group_config
from kaikei.application.contracts import (
    AccountMappingOut,
    FilePreviewOut,
    PreviewRowOut,
    SourceFileOut,
    UploadResultOut,
)
from kaikei.application.pipeline import RunRecord
from kaikei.application.presentation import file_id, money, source_ref_out
from kaikei.application.rule_catalog import rule_info
from kaikei.domain.validation.models import Severity

_PREVIEW_ROWS = 20


class UnknownUploadError(Exception):
    """Raised when an uploaded file can't be identified as one of the group's packs."""


@dataclass
class StoredFile:
    """One stored original. Never mutated in place except by a genuinely new upload."""

    company_id: str
    filename: str
    sha256: str
    line_count: int
    uploaded_at: datetime
    status: str
    mapping_version: str | None = None


@dataclass
class Registry:
    files: dict[str, StoredFile] = field(default_factory=dict)  # company_id -> file


_REGISTRY: dict[str, Registry] = {}


def _line_count(path: Path) -> int:
    with path.open(encoding="utf-8-sig") as fh:
        return sum(1 for _ in fh)


def registry(group_id: str) -> Registry:
    """The group's stored originals, registered from its data directory on first read."""
    existing = _REGISTRY.get(group_id)
    if existing is not None:
        return existing

    from kaikei.application.pipeline import _INGEST

    group = group_config.get_group(group_id)
    if group is None:
        _REGISTRY[group_id] = Registry()
        return _REGISTRY[group_id]
    root = group_config.pack_dir(group_id)
    reg = Registry()
    for company in group_config.load_companies(group_id):
        if root is None or not company.entity.file:
            continue
        path = root / company.entity.file
        if not path.is_file():
            continue  # no pack on disk: the file is MISSING, reported as such below
        data = path.read_bytes()
        approved = company.entity.entity_id in _INGEST
        reg.files[company.entity.entity_id] = StoredFile(
            company_id=company.entity.entity_id,
            filename=company.entity.file,
            sha256=hashlib.sha256(data).hexdigest(),
            line_count=_line_count(path),
            uploaded_at=datetime.fromtimestamp(path.stat().st_mtime, tz=UTC),
            status="MAPPING_APPROVED" if approved else "UPLOADED",
            mapping_version=group.mapping_version if approved else None,
        )
    _REGISTRY[group_id] = reg
    return reg


def _parse_warnings(record: RunRecord | None, company_id: str) -> list[str]:
    """Non-blocking findings raised while reading this company's pack."""
    if record is None:
        return []
    return [
        rule_info(f.rule_id).title
        for f in record.findings
        if company_id in f.company_ids and f.severity != Severity.BLOCKER
    ]


def list_files(group_id: str, record: RunRecord | None) -> list[SourceFileOut]:
    """Every company's pack, in company order. A company with no pack reports MISSING."""
    reg = registry(group_id)
    out: list[SourceFileOut] = []
    for company in group_config.load_companies(group_id):
        company_id = company.entity.entity_id
        stored = reg.files.get(company_id)
        if stored is None:
            out.append(
                SourceFileOut(
                    id=file_id(company_id),
                    company_id=company_id,
                    filename=company.entity.file,
                    status="MISSING",
                    format=company.file_format,
                )
            )
            continue
        records = (
            sum(1 for r in record.records.values() if r.company_id == company_id)
            if record is not None
            else None
        )
        out.append(
            SourceFileOut(
                id=file_id(company_id),
                company_id=company_id,
                filename=stored.filename,
                sha256=stored.sha256,
                uploaded_at=stored.uploaded_at,
                status=stored.status,
                format=company.file_format,
                rows=stored.line_count,
                # Canonical records this run extracted; None when this slice's pipeline
                # doesn't yet read the company's layout, never 0 (which would read as "empty").
                records=records or None,
                parse_warnings=_parse_warnings(record, company_id),
                mapping_version=stored.mapping_version,
            )
        )
    return out


def company_of_file(group_id: str, file_identifier: str) -> str | None:
    for company_id in registry(group_id).files:
        if file_id(company_id) == file_identifier:
            return company_id
    return None


def account_mapping(group_id: str, company_id: str) -> list[AccountMappingOut]:
    """The company's reviewer-confirmed account mapping, exactly as the engine reads it."""
    return [
        AccountMappingOut(
            local_code=entry.local_code,
            local_name=entry.local_name,
            group_account=entry.group_account,
            type=entry.account_type,
            partner=entry.counterparty,
        )
        for entry in group_config.mapping_entries(group_id, company_id)
    ]


def preview(group_id: str, file_identifier: str, record: RunRecord | None) -> FilePreviewOut | None:
    """The pack as the engine parsed it: canonical records with their source cells.

    The rows are the run's own canonical records, not a second parse — the preview shows
    what the engine read, or nothing when this slice has no normalizer for that layout.
    """
    company_id = company_of_file(group_id, file_identifier)
    if company_id is None:
        return None
    rows: list[PreviewRowOut] = []
    if record is not None:
        for canonical in list(record.records.values()):
            if canonical.company_id != company_id or len(rows) >= _PREVIEW_ROWS:
                continue
            rows.append(
                PreviewRowOut(
                    source=source_ref_out(record, canonical.source, company_id=company_id),
                    local_account=canonical.local_account_code,
                    local_name=canonical.local_account_name or "",
                    period=canonical.period,
                    amount_local=money(canonical.amount_local),
                    currency=canonical.currency,
                    group_account=canonical.group_account_code,
                    partner_company_id=None,
                    statement=canonical.statement.value,
                )
            )
    return FilePreviewOut(
        file_id=file_identifier,
        rows=rows,
        account_mapping=account_mapping(group_id, company_id),
    )


def _is_text(data: bytes) -> bool:
    """Whether these bytes are a text file at all: UTF-8 decodable, no control characters.

    Content, not the extension, decides. Nothing is executed and nothing is interpreted — the
    bytes are only examined (MANIFESTO §4.5 3: file content is quoted data).
    """
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return False
    return not any(ch < " " and ch not in "\t\r\n" for ch in text)


def upload(group_id: str, filename: str, data: bytes) -> UploadResultOut:
    """Store an original and say whether this exact file was already imported (§4.1 ①).

    Identification is by hash first, then by the filename the group's configuration expects.
    A file this build can't place is refused with a reason — never accepted and ignored.
    """
    reg = registry(group_id)
    sha256 = hashlib.sha256(data).hexdigest()
    group = group_config.get_group(group_id)
    if group is None:
        raise UnknownUploadError(f"group {group_id!r} is not configured")

    by_hash = next((f for f in reg.files.values() if f.sha256 == sha256), None)
    if by_hash is not None:
        return UploadResultOut(file=_stored_out(group_id, by_hash), already_imported=True)

    expected = {c.entity.file: c.entity.entity_id for c in group_config.load_companies(group_id)}
    company_id = expected.get(filename)
    if company_id is None:
        raise UnknownUploadError(
            f"{filename!r} is not one of {group.name}'s expected packs "
            f"({', '.join(sorted(expected))}). Layout detection for arbitrary files is K2 work."
        )
    if filename.lower().endswith(".csv") and not _is_text(data):
        # A name is not evidence. MANIFESTO §4.1 ①: an unreadable file is rejected, and a
        # binary blob wearing a .csv name is exactly that — never stored as a usable pack.
        raise UnknownUploadError(
            f"{filename!r} is not readable as text: its bytes are binary, whatever the "
            "extension says. Nothing was stored."
        )
    stored = StoredFile(
        company_id=company_id,
        filename=filename,
        sha256=sha256,
        line_count=len(data.decode("utf-8-sig", errors="replace").splitlines()),
        uploaded_at=datetime.now(UTC),
        status="UPLOADED",
        mapping_version=None,
    )
    reg.files[company_id] = stored
    return UploadResultOut(file=_stored_out(group_id, stored), already_imported=False)


def approve_mapping(group_id: str, company_id: str) -> SourceFileOut:
    """Freeze the mapping version for one company's pack (MANIFESTO §4.4 mapping approval)."""
    reg = registry(group_id)
    stored = reg.files.get(company_id)
    if stored is None:
        raise KeyError(company_id)
    stored.status = "MAPPING_APPROVED"
    group = group_config.get_group(group_id)
    stored.mapping_version = group.mapping_version if group else None
    return _stored_out(group_id, stored)


def _stored_out(group_id: str, stored: StoredFile) -> SourceFileOut:
    formats = {c.entity.entity_id: c.file_format for c in group_config.load_companies(group_id)}
    return SourceFileOut(
        id=file_id(stored.company_id),
        company_id=stored.company_id,
        filename=stored.filename,
        sha256=stored.sha256,
        uploaded_at=stored.uploaded_at,
        status=stored.status,
        format=formats.get(stored.company_id, ""),
        rows=stored.line_count,
        records=None,
        parse_warnings=[],
        mapping_version=stored.mapping_version,
    )
