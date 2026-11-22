"""Ingestion entry point: bytes -> SourceRows + findings. Pure domain, no DB, no HTTP."""

from __future__ import annotations

from kaikei.domain.ingestion.adapters import ADAPTER_VERSION, Ctx, select_adapter
from kaikei.domain.ingestion.csv_source import (
    decode,
    detect_delimiter,
    split_preamble,
    tokenize,
)
from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.ingestion.rows import IngestHint, IngestResult
from kaikei.domain.ingestion.safety import (
    DEFAULT_MAX_BYTES,
    check_file,
    make_finding,
    sha256_bytes,
)
from kaikei.domain.validation.models import Severity


def ingest_file(
    filename: str,
    data: bytes,
    *,
    hint: IngestHint | None = None,
    max_bytes: int = DEFAULT_MAX_BYTES,
) -> IngestResult:
    """Ingest an uploaded CSV. Never raises on bad content: problems become findings."""
    hint = hint or IngestHint()
    result = IngestResult(filename=filename, sha256=sha256_bytes(data), size=len(data))
    result.findings.extend(check_file(filename, data, max_bytes))
    if not result.accepted:
        return result
    if filename.lower().endswith(".xlsx"):
        raise NotImplementedError("XLSX adapter (owner: Jose)")

    file_ref = SourceRef(filename=filename)
    text, result.encoding = decode(data)
    if result.encoding not in ("utf-8",):
        sev = Severity.INFO if result.encoding == "utf-8-sig" else Severity.WARNING
        result.findings.append(
            make_finding(
                "PARSER-001",
                sev,
                f"file decoded as {result.encoding}",
                reason_code="ENCODING_" + result.encoding.upper().replace("-", "_"),
                refs=[file_ref],
            )
        )

    result.preamble, rest, consumed = split_preamble(text, hint)
    if result.preamble:
        result.findings.append(
            make_finding(
                "PARSER-001",
                Severity.INFO,
                f"{len(result.preamble)} preamble line(s) skipped and recorded",
                reason_code="PREAMBLE_SKIPPED",
                refs=[
                    SourceRef(filename=filename, row=p.row, cell=f"A{p.row}", raw=p.text)
                    for p in result.preamble
                ],
            )
        )
    if not rest.strip():
        result.findings.append(
            make_finding(
                "PARSER-010",
                Severity.BLOCKER,
                "no header or data after preamble",
                reason_code="NO_HEADER",
                refs=[file_ref],
            )
        )
        return result

    result.delimiter = detect_delimiter(rest, hint)
    lines = tokenize(rest, result.delimiter, consumed)

    locale = hint.numeric_locale
    if locale is None and result.delimiter == ";":
        locale = "decimal_comma"
        result.findings.append(
            make_finding(
                "PARSER-002",
                Severity.INFO,
                "semicolon delimiter: decimal comma inferred (no numeric_locale hint)",
                reason_code="LOCALE_INFERRED",
                refs=[file_ref],
            )
        )
    result.numeric_locale = locale

    ctx = Ctx(filename=filename, hint=hint, locale=locale)
    adapter = select_adapter(lines, ctx)
    if adapter is None:
        result.findings.append(
            make_finding(
                "PARSER-001",
                Severity.BLOCKER,
                "no adapter matches the file structure; supply an IngestHint.adapter",
                reason_code="NO_ADAPTER",
                refs=[file_ref],
            )
        )
        return result
    result.adapter = f"{adapter.name}@{ADAPTER_VERSION}"
    result.rows = adapter.parse(lines, ctx)
    result.headers, result.header_rows = ctx.headers, ctx.header_rows
    result.header_currency = ctx.header_currency
    result.findings.extend(ctx.findings)
    return result
