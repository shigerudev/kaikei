"""File safety checks, hashing and finding helpers (PARSER-007/008/009)."""

from __future__ import annotations

import hashlib
import re

from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.validation.models import Finding, Severity

ALLOWED_EXTENSIONS = (".csv", ".xlsx")
DEFAULT_MAX_BYTES = 10 * 1024 * 1024
RULE_VERSION = "1"
_CONTROL = re.compile(rb"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def make_finding(
    rule_id: str,
    severity: Severity,
    reason: str,
    *,
    reason_code: str,
    refs: list[SourceRef] | None = None,
    context: dict[str, str] | None = None,
) -> Finding:
    """Deterministic finding id: same input -> same findings."""
    first = refs[0] if refs else None
    where = f"{first.filename}:{first.cell or first.row or '-'}" if first else "file"
    return Finding(
        finding_id=f"{rule_id}:{reason_code}:{where}",
        rule_id=rule_id,
        rule_version=RULE_VERSION,
        severity=severity,
        source_refs=refs or [],
        reason=reason,
        reason_code=reason_code,
        context=context,
    )


def check_file(filename: str, data: bytes, max_bytes: int = DEFAULT_MAX_BYTES) -> list[Finding]:
    """BLOCKER findings (PARSER-008) when the upload must not be parsed. Empty list = safe."""
    ref = SourceRef(filename=filename)
    out: list[Finding] = []

    def block(code: str, reason: str) -> None:
        out.append(
            make_finding("PARSER-008", Severity.BLOCKER, reason, reason_code=code, refs=[ref])
        )

    lower = filename.lower()
    ext = next((e for e in ALLOWED_EXTENSIONS if lower.endswith(e)), None)
    if ext is None:
        block("EXTENSION_NOT_ALLOWED", f"only {', '.join(ALLOWED_EXTENSIONS)} files are accepted")
    if len(data) > max_bytes:
        block("FILE_TOO_LARGE", f"{len(data)} bytes exceeds the {max_bytes} byte cap")
    if not data:
        block("EMPTY_FILE", "file is empty")
    elif ext == ".csv" and (b"\x00" in data or _CONTROL.search(data)):
        block("BINARY_CONTENT", "CSV contains NUL/control bytes; refusing to parse binary data")
    elif ext == ".csv" and data.startswith(b"PK\x03\x04"):
        block("SIGNATURE_MISMATCH", "file is a ZIP/XLSX container but named .csv")
    elif ext == ".xlsx" and not data.startswith(b"PK\x03\x04"):
        block("SIGNATURE_MISMATCH", "file named .xlsx does not have a ZIP signature")
    return out
