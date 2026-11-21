"""Encoding, preamble and delimiter detection; physical-row CSV tokenizing (PARSER-001/010)."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass

from kaikei.domain.ingestion.rows import IngestHint, PreambleLine

CANDIDATE_DELIMITERS = (",", ";", "\t", "|")


@dataclass(frozen=True)
class RawLine:
    row: int  # 1-based physical line where the record starts
    cells: list[str]


def decode(data: bytes) -> tuple[str, str]:
    """UTF-8-BOM -> UTF-8 -> Windows-1252 fallback (latin-1 if cp1252 has undefined bytes)."""
    if data.startswith(b"\xef\xbb\xbf"):
        return data[3:].decode("utf-8"), "utf-8-sig"
    try:
        return data.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        pass
    try:
        return data.decode("cp1252"), "cp1252"
    except UnicodeDecodeError:
        return data.decode("latin-1"), "latin-1"


def split_preamble(text: str, hint: IngestHint) -> tuple[list[PreambleLine], str, int]:
    """Leading lines starting with a preamble prefix. Returns (lines, rest, lines_consumed)."""
    lines = text.splitlines(keepends=True)
    pre: list[PreambleLine] = []
    for i, line in enumerate(lines):
        if line.strip() and line.lstrip().startswith(hint.preamble_prefixes):
            pre.append(PreambleLine(row=i + 1, text=line.rstrip("\r\n")))
        else:
            break
    return pre, "".join(lines[len(pre) :]), len(pre)


def detect_delimiter(rest: str, hint: IngestHint) -> str:
    """Delimiter from the header line (first non-blank line): most fields wins; ties -> order."""
    if hint.delimiter:
        return hint.delimiter
    header = next((ln for ln in rest.splitlines() if ln.strip()), "")
    best, best_n = ",", 1
    for d in CANDIDATE_DELIMITERS:
        row = next(csv.reader([header], delimiter=d), [])
        if len(row) > best_n:
            best, best_n = d, len(row)
    return best


def tokenize(rest: str, delimiter: str, line_offset: int) -> list[RawLine]:
    reader = csv.reader(io.StringIO(rest, newline=""), delimiter=delimiter, strict=False)
    out: list[RawLine] = []
    prev_end = 0
    for cells in reader:
        out.append(RawLine(row=prev_end + 1 + line_offset, cells=cells))
        prev_end = reader.line_num
    return out


def column_letter(index: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA."""
    s = ""
    n = index + 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s
