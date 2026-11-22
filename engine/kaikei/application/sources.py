"""Stored originals and their parsed preview (`/files`, MANIFESTO §4.4, §4.1 ①).

One pack per company. Each file is identified by the SHA-256 of its untouched bytes, so the
same hash in the same group is "already imported" rather than a second import (§4.1 ①), and
nothing here ever rewrites a stored original (MANIFESTO principle 2).

Production reads `source_files` / object storage. Tests keep an in-process registry filled by
the seed helper or by `upload` — never by walking `fixtures/` at request time.
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
from kaikei.application.uploads import normalize_alias
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
    data: bytes | None = None


@dataclass
class Registry:
    files: dict[str, StoredFile] = field(default_factory=dict)  # company_id -> file


_REGISTRY: dict[str, Registry] = {}


def _line_count(path: Path) -> int:
    with path.open(encoding="utf-8-sig") as fh:
        return sum(1 for _ in fh)


def reset_sample_packs() -> None:
    """Drop stored originals and reload each configured group's seed packs."""
    _REGISTRY.clear()
    for state in group_config.list_states():
        if state.pack_root is not None:
            register_sample_packs(state.meta.id, state.pack_root)


def registry(group_id: str) -> Registry:
    """In-process originals for this group (tests / seed). Empty until something is stored."""
    existing = _REGISTRY.get(group_id)
    if existing is not None:
        return existing
    reg = Registry()
    _REGISTRY[group_id] = reg
    return reg


def register_sample_packs(group_id: str, pack_root: Path) -> None:
    """Load each company's named pack from a seed directory (tests and the seed command only)."""
    group = group_config.get_group(group_id)
    if group is None or pack_root is None:
        return
    reg = registry(group_id)
    for company in group_config.load_companies(group_id):
        if not company.entity.file:
            continue
        path = pack_root / company.entity.file
        if not path.is_file():
            continue
        data = path.read_bytes()
        approved = bool(group_config.mapping_entries(group_id, company.entity.entity_id))
        reg.files[company.entity.entity_id] = StoredFile(
            company_id=company.entity.entity_id,
            filename=company.entity.file,
            sha256=hashlib.sha256(data).hexdigest(),
            line_count=_line_count(path),
            uploaded_at=datetime.fromtimestamp(path.stat().st_mtime, tz=UTC),
            status="MAPPING_APPROVED" if approved else "UPLOADED",
            mapping_version=group.mapping_version if approved else None,
            data=data,
        )


def hydrate_packs_from_db(group_id: str) -> None:
    """Fill missing pack bytes from `source_files` + object storage. Never opens fixtures/."""
    session = group_config._try_session()
    if session is None:
        return
    try:
        from sqlalchemy import select

        from kaikei.application.group_service import ConfigError, get_group_row
        from kaikei.infrastructure.db.models import Company, SourceFile
        from kaikei.infrastructure.storage import get_object_store
        from kaikei.settings import get_settings

        group = get_group_row(session, group_id)
        store = get_object_store(get_settings())
        companies = {
            c.id: c for c in session.scalars(select(Company).where(Company.group_id == group.id))
        }
        files = session.scalars(
            select(SourceFile)
            .where(SourceFile.group_id == group.id)
            .order_by(SourceFile.uploaded_at)
        )
        latest: dict = {}
        for row in files:
            if row.company_id is not None:
                latest[row.company_id] = row
        reg = registry(group_id)
        meta = group_config.get_group(group_id)
        for company_uuid, row in latest.items():
            company = companies.get(company_uuid)
            if company is None:
                continue
            existing = reg.files.get(company.code)
            if existing is not None and existing.data:
                continue
            try:
                data = store.get(row.stored_uri)
            except Exception:  # noqa: BLE001 — storage miss is a missing pack, not a crash
                continue
            approved = bool(group_config.mapping_entries(group_id, company.code))
            reg.files[company.code] = StoredFile(
                company_id=company.code,
                filename=row.filename,
                sha256=row.sha256,
                line_count=len(data.decode("utf-8-sig", errors="replace").splitlines()),
                uploaded_at=row.uploaded_at,
                status="MAPPING_APPROVED" if approved else "UPLOADED",
                mapping_version=meta.mapping_version if meta and approved else None,
                data=data,
            )
    except ConfigError:
        return
    except Exception:  # noqa: BLE001 — no DB / no store: leave the registry as-is
        return
    finally:
        session.close()


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


def _resolve_upload_company(group_id: str, filename: str, company_id: str | None) -> str | None:
    companies = group_config.load_companies(group_id)
    ids = {c.entity.entity_id for c in companies}
    if company_id:
        if company_id in ids:
            return company_id
        raise UnknownUploadError(f"company {company_id!r} is not in this group")
    expected = {c.entity.file: c.entity.entity_id for c in companies}
    if filename in expected:
        return expected[filename]
    stem = normalize_alias(Path(filename).stem)
    hits: list[str] = []
    for company in companies:
        aliases = [
            normalize_alias(company.entity.entity_id),
            normalize_alias(company.entity.name),
            *(normalize_alias(a) for a in company.entity.aliases),
        ]
        if stem and stem in aliases:
            hits.append(company.entity.entity_id)
    if len(hits) == 1:
        return hits[0]
    return None


def upload(
    group_id: str, filename: str, data: bytes, *, company_id: str | None = None
) -> UploadResultOut:
    """Store an original and say whether this exact file was already imported (§4.1 ①).

    Identification is by hash first. Any CSV name is accepted when `company_id` is given
    or the filename uniquely matches a configured pack / alias.
    """
    reg = registry(group_id)
    sha256 = hashlib.sha256(data).hexdigest()
    group = group_config.get_group(group_id)
    if group is None:
        raise UnknownUploadError(f"group {group_id!r} is not configured")

    by_hash = next((f for f in reg.files.values() if f.sha256 == sha256), None)
    if by_hash is not None:
        return UploadResultOut(file=_stored_out(group_id, by_hash), already_imported=True)

    resolved = _resolve_upload_company(group_id, filename, company_id)
    if resolved is None:
        raise UnknownUploadError(
            f"{filename!r} does not uniquely identify a company in {group.name}; "
            "pass company_id. Nothing was stored."
        )
    if filename.lower().endswith(".csv") and not _is_text(data):
        # A name is not evidence. MANIFESTO §4.1 ①: an unreadable file is rejected, and a
        # binary blob wearing a .csv name is exactly that — never stored as a usable pack.
        raise UnknownUploadError(
            f"{filename!r} is not readable as text: its bytes are binary, whatever the "
            "extension says. Nothing was stored."
        )
    stored = StoredFile(
        company_id=resolved,
        filename=filename,
        sha256=sha256,
        line_count=len(data.decode("utf-8-sig", errors="replace").splitlines()),
        uploaded_at=datetime.now(UTC),
        status="UPLOADED",
        mapping_version=None,
        data=data,
    )
    reg.files[resolved] = stored
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
