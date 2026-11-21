"""Shared acceptance-suite plumbing (SCOPE_AND_TASKS section 5.2, AC1-AC15).

Rules of this suite:
- Expected values come from the fixture pack itself (README, answer keys, group tables),
  parsed at test time. Never from engine output.
- Run-level behavior goes through the public HTTP API (`TestClient(kaikei.main.app)`).
- A failing test here is information, not a bug in the test. Nothing is weakened to pass.
"""

from __future__ import annotations

import csv
import hashlib
import re
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

import pytest

FIX = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"
GROUP_ID = "grupo-ag"
API = "/api/v1"


# --------------------------------------------------------------------------- fixture pack


def read_csv_file(name: str) -> list[dict[str, str]]:
    with (FIX / name).open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def entity_files() -> dict[str, str]:
    return {e["entity"]: e["file"] for e in read_csv_file("entidades.csv")}


def entity_currencies() -> dict[str, str]:
    return {e["entity"]: e["currency"] for e in read_csv_file("entidades.csv")}


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def answer_key_mapping() -> list[dict[str, str]]:
    return read_csv_file("answer_key_mapping.csv")


def group_rates() -> dict[tuple[str, str, str], Decimal]:
    """(currency, rate_type, period) -> USD per 1 unit, straight from tasas_grupo.csv."""
    out: dict[tuple[str, str, str], Decimal] = {}
    for row in read_csv_file("tasas_grupo.csv"):
        if row["currency"] == "USD":
            continue
        out[(row["currency"], row["rate_type"], row["period"])] = Decimal(row["usd_per_unit"])
    return out


def source_cell(filename: str, row: int, column: str) -> str | None:
    """The raw text of one cell in a fixture file (1-indexed file line, nearest header above)."""
    lines = (FIX / filename).read_text(encoding="utf-8-sig").splitlines()
    delimiter = ";" if any(line.count(";") > line.count(",") for line in lines[:4]) else ","
    if row < 1 or row > len(lines):
        return None
    fields = next(csv.reader([lines[row - 1]], delimiter=delimiter))
    for header_line in range(row - 1, 0, -1):
        header = next(csv.reader([lines[header_line - 1]], delimiter=delimiter))
        if column in header:
            index = header.index(column)
            return fields[index] if index < len(fields) else ""
    return None


# --------------------------------------------------------------------------- answer key


@dataclass(frozen=True)
class Expected:
    """One planted error, parsed from answer_key_errors.csv."""

    id: str
    file: str
    error_type: str
    lines: frozenset[int] | None  # None: the key gives no line (a missing row)
    alternates: frozenset[tuple[str, int]] = field(default_factory=frozenset)
    """Other cells the key's own `detail` text cites, e.g. the other side of an IC pair."""


# MANIFESTO section 4.3 "Planted" column: which rule owns which answer-key error type.
RULE_FOR_ERROR_TYPE = {
    "duplicate_row": "VAL-006",
    "intercompany_mismatch": "VAL-008",
    "subtotal_mismatch": "VAL-010",
    "sign_error": "VAL-019",
    "missing_period": "VAL-020",
    "wrong_currency": "VAL-021",
    "unmapped_account": "VAL-003",
    "intercompany_one_sided": "VAL-007",
    "number_format": "VAL-022",
    "balance_not_balanced": "VAL-023",
    "fx_assumption_conflict": "VAL-024",
}

_FILE_LINE = re.compile(r"(\d\d_\w+\.csv) line (\d+)")
_LINES = re.compile(r"lines? (\d+)(?:-(\d+))?")


def parse_answer_key() -> list[Expected]:
    expected: list[Expected] = []
    for row in read_csv_file("answer_key_errors.csv"):
        m = _LINES.search(row["location"])
        lines = None
        if m:
            lo, hi = int(m.group(1)), int(m.group(2) or m.group(1))
            lines = frozenset(range(lo, hi + 1))
        alternates = frozenset((f, int(n)) for f, n in _FILE_LINE.findall(row["detail"]))
        expected.append(
            Expected(
                id=row["id"],
                file=row["file"],
                error_type=row["error_type"],
                lines=lines,
                alternates=alternates,
            )
        )
    return expected


def finding_matches(finding: dict, exp: Expected) -> bool:
    """Right rule, and a source cell at the key's file and line (or file, when no line)."""
    if finding["rule_id"] != RULE_FOR_ERROR_TYPE[exp.error_type]:
        return False
    for ref in finding["source_refs"]:
        if ref["filename"] == exp.file and (exp.lines is None or ref.get("row") in exp.lines):
            return True
        if (ref["filename"], ref.get("row")) in exp.alternates:
            return True
    return False


# --------------------------------------------------------------------------- API helpers


@pytest.fixture(scope="session")
def client():
    try:
        from fastapi.testclient import TestClient

        from kaikei.main import app
    except Exception as exc:  # the app itself is broken: fail loudly, never skip
        pytest.fail(f"kaikei.main.app does not import: {type(exc).__name__}: {exc}")
    return TestClient(app)


def start_run(client) -> dict:
    resp = client.post(f"{API}/consolidations")
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture(scope="session")
def baseline(client) -> dict:
    """One run shared by the read-only checks. Mutating checks (AC9) start their own."""
    return start_run(client)


@pytest.fixture(scope="session")
def findings(client, baseline) -> list[dict]:
    resp = client.get(f"{API}/consolidations/{baseline['id']}/findings")
    assert resp.status_code == 200, resp.text
    return resp.json()


@pytest.fixture(scope="session")
def reconciliations(client, baseline) -> dict:
    resp = client.get(f"{API}/consolidations/{baseline['id']}/reconciliations")
    assert resp.status_code == 200, resp.text
    return resp.json()


def statement_rows(client, run_id: str, period: str | None, statement: str) -> list[dict]:
    params = {"statement": statement}
    if period:
        params["period"] = period
    resp = client.get(f"{API}/consolidations/{run_id}/facts", params=params)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["rows"] if isinstance(body, dict) else body


@pytest.fixture(scope="session")
def lineages(client, baseline) -> list[tuple[dict, dict]]:
    """(fact row, lineage) for every line fact of the FY2027 P&L and the closing balance sheet."""
    out: list[tuple[dict, dict]] = []
    for statement, period in (("PL", "2027"), ("BS", None)):
        for row in statement_rows(client, baseline["id"], period, statement):
            if row["kind"] != "line":
                continue
            resp = client.get(f"{API}/facts/{row['id']}/lineage")
            assert resp.status_code == 200, resp.text
            out.append((row, resp.json()))
    return out


def strip_run_id(obj, run_id: str):
    """Make a JSON structure comparable across runs by neutralising the run id."""
    if isinstance(obj, dict):
        return {k: strip_run_id(v, run_id) for k, v in obj.items() if k != "run_id"}
    if isinstance(obj, list):
        return [strip_run_id(v, run_id) for v in obj]
    if isinstance(obj, str):
        return obj.replace(run_id, "<run>")
    return obj
