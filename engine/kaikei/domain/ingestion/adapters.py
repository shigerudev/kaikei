"""Format-family adapters: raw RawLines -> SourceRows. Selection is by structure + hint.

Families: `long` (one amount column), `debit_credit`, `wide` (month columns, stacked blocks,
hardcoded subtotals). No company names anywhere; per-company behaviour comes from IngestHint.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Protocol

from kaikei.domain.ingestion.csv_source import RawLine, column_letter
from kaikei.domain.ingestion.models import SourceRef
from kaikei.domain.ingestion.numbers import (
    month_from_label,
    parse_decimal_ex,
    parse_period,
)
from kaikei.domain.ingestion.rows import IngestHint, SourceCell, SourceRow
from kaikei.domain.ingestion.safety import make_finding
from kaikei.domain.validation.models import Finding, Severity

ADAPTER_VERSION = "1"


def _n(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


@dataclass
class Ctx:
    filename: str
    hint: IngestHint
    locale: str | None
    findings: list[Finding] = field(default_factory=list)
    header_currency: str | None = None
    headers: list[str] = field(default_factory=list)
    header_rows: list[int] = field(default_factory=list)

    def ref(self, row: int, idx: int, header: str, raw: str) -> SourceRef:
        return SourceRef(
            filename=self.filename,
            sheet=None,
            row=row,
            column=header,
            cell=f"{column_letter(idx)}{row}",
            raw=raw,
        )

    def add(self, rule: str, sev: Severity, reason: str, code: str, ref: SourceRef) -> None:
        self.findings.append(make_finding(rule, sev, reason, reason_code=code, refs=[ref]))


class Adapter(Protocol):
    name: str

    def matches(self, lines: list[RawLine], ctx: Ctx) -> bool: ...
    def parse(self, lines: list[RawLine], ctx: Ctx) -> list[SourceRow]: ...


# ---- shared cell parsing --------------------------------------------------


def _is_blank(cells: list[str]) -> bool:
    return not any(c.strip() for c in cells)


def _amount_cell(ctx: Ctx, row: int, idx: int, header: str, raw: str, *, report_blank=True):
    ref = ctx.ref(row, idx, header, raw)
    p = parse_decimal_ex(raw, ctx.locale)
    if p.status == "ok":
        return SourceCell(ref, raw, p.value)
    if p.status == "locale_mismatch":
        ctx.add("PARSER-002", Severity.WARNING, f"{raw!r}: {p.reason}", "LOCALE_MISMATCH", ref)
        return SourceCell(ref, raw, p.value, ("locale_mismatch",))
    if p.status == "blank":
        if report_blank:
            ctx.add(
                "PARSER-005", Severity.WARNING, "blank amount kept as blank, not 0", "BLANK", ref
            )
        return SourceCell(ref, raw, None, ("blank",))
    codes = {
        "placeholder": ("PARSER-005", Severity.WARNING, "PLACEHOLDER"),
        "ambiguous": ("PARSER-002", Severity.WARNING, "AMBIGUOUS_NUMBER"),
        "invalid": ("PARSER-002", Severity.WARNING, "INVALID_NUMBER"),
        "formula_like": ("PARSER-009", Severity.WARNING, "FORMULA_LIKE"),
    }
    rule, sev, code = codes[p.status]
    ctx.add(rule, sev, f"{raw!r}: {p.reason}", code, ref)
    return SourceCell(ref, raw, None, (code.lower(),))


def _text_cell(ctx: Ctx, row: int, idx: int, header: str, raw: str) -> SourceCell:
    ref = ctx.ref(row, idx, header, raw)
    s = raw.strip()
    if s and s[0] in "=+-@" and parse_decimal_ex(s, None).status in ("invalid", "formula_like"):
        ctx.add(
            "PARSER-009",
            Severity.WARNING,
            f"{raw!r} looks like a formula; kept as raw text, never evaluated",
            "FORMULA_LIKE",
            ref,
        )
        return SourceCell(ref, raw, raw, ("formula_like",))
    return SourceCell(ref, raw, raw if s else None, () if s else ("blank",))


def _is_note(cells: list[str], ctx: Ctx) -> bool:
    first = _n(cells[0]) if cells else ""
    return bool(first) and first.startswith(tuple(_n(p) for p in ctx.hint.note_prefixes))


# ---- role detection for tabular formats -----------------------------------

_ROLE_WORDS = {
    "period": {"mes", "month", "fecha", "date", "periodo", "period"},
    "year": {"ejercicio", "year", "ano"},
    "description": {"descripcion", "nombre de cuenta", "description", "concepto"},
    "scenario": {"escenario", "scenario"},
    "counterparty": {"contraparte", "sociedad contraparte", "intercompany"},
    "currency": {"moneda", "currency"},
    "statement_type": set(),
}
_CCY_IN_HEADER = re.compile(r"\(([^)]+)\)\s*$")
_HEADER_CCY = {"€": "EUR", "$": "USD", "Q": "GTQ"}


def detect_roles(headers: list[str]) -> dict[str, str]:
    """role -> header. Unknown headers are simply not mapped (cells stay in the row)."""
    roles: dict[str, str] = {}
    norm = [_n(re.sub(r"\s*\([^)]*\)\s*$", "", h)) for h in headers]
    has_desc = any(x in _ROLE_WORDS["description"] and x != "concepto" for x in norm)
    for h, x in zip(headers, norm, strict=True):
        if x in ("cuenta", "codigo", "account", "cuenta contable"):
            roles.setdefault("account" if (has_desc or x != "cuenta") else "description", h)
            continue
        if x.startswith(("monto", "importe", "valor", "amount")):
            roles.setdefault("amount", h)
        elif x.startswith(("debit", "debe")):
            roles.setdefault("debit", h)
        elif x.startswith(("credit", "haber")):
            roles.setdefault("credit", h)
        elif x in ("tipo", "type"):
            roles.setdefault("scenario_or_type", h)
        else:
            for role, words in _ROLE_WORDS.items():
                if x in words:
                    roles.setdefault(role, h)
    if "scenario_or_type" in roles:
        if "scenario" not in roles:
            roles["scenario"] = roles["scenario_or_type"]
        else:
            roles["statement_type"] = roles["scenario_or_type"]
        del roles["scenario_or_type"]
    return roles


def _header_currency(headers: list[str]) -> str | None:
    for h in headers:
        m = _CCY_IN_HEADER.search(h)
        if m and _n(h).startswith(("monto", "importe", "valor", "amount", "debit", "credit")):
            tok = m.group(1).strip()
            return _HEADER_CCY.get(tok, tok if re.fullmatch(r"[A-Z]{3}", tok) else None)
    return None


class _TabularBase:
    name = ""
    amount_roles: tuple[str, ...] = ()

    def _header(self, lines: list[RawLine]) -> RawLine | None:
        return next((ln for ln in lines if not _is_blank(ln.cells)), None)

    def parse(self, lines: list[RawLine], ctx: Ctx) -> list[SourceRow]:
        header = self._header(lines)
        assert header is not None
        headers = [h.strip() or f"col_{column_letter(i)}" for i, h in enumerate(header.cells)]
        seen: dict[str, int] = {}
        for i, h in enumerate(headers):  # disambiguate duplicate header names
            seen[h] = seen.get(h, 0) + 1
            if seen[h] > 1:
                headers[i] = f"{h}#{seen[h]}"
        ctx.headers, ctx.header_rows = headers, [header.row]
        ctx.header_currency = _header_currency(headers)
        roles = detect_roles(headers)
        known = set(roles.values())
        for i, h in enumerate(headers):
            if h not in known:
                ctx.add(
                    "PARSER-006",
                    Severity.INFO,
                    f"column {h!r} is not a recognised role; kept as raw text",
                    "UNKNOWN_COLUMN",
                    ctx.ref(header.row, i, h, header.cells[i]),
                )
        out: list[SourceRow] = []
        for ln in lines[lines.index(header) + 1 :]:
            out.append(self._row(ln, headers, roles, ctx))
        return out

    def _row(self, ln: RawLine, headers: list[str], roles: dict[str, str], ctx: Ctx) -> SourceRow:
        if _is_blank(ln.cells):
            return SourceRow(ln.row, "blank", {}, flags=("blank",))
        names = list(headers) + [
            f"col_{column_letter(i)}" for i in range(len(headers), len(ln.cells))
        ]
        if len(ln.cells) != len(headers):
            ctx.add(
                "PARSER-010",
                Severity.WARNING,
                f"row has {len(ln.cells)} fields, header has {len(headers)}",
                "RAGGED_ROW",
                ctx.ref(ln.row, 0, names[0], ln.cells[0]),
            )
        kind = "note" if _is_note(ln.cells, ctx) else "data"
        amount_headers = {roles[r] for r in self.amount_roles if r in roles}
        cells: dict[str, SourceCell] = {}
        for i, raw in enumerate(ln.cells):
            h = names[i]
            if kind == "note":
                cells[h] = _text_cell(ctx, ln.row, i, h, raw)
            elif h in amount_headers:
                optional = self.amount_roles != (
                    "amount",
                )  # debit/credit: one side blank is normal
                cells[h] = _amount_cell(ctx, ln.row, i, h, raw, report_blank=not optional)
            else:
                cells[h] = _text_cell(ctx, ln.row, i, h, raw)
        row = SourceRow(ln.row, kind, cells, roles=dict(roles))
        if kind == "data":
            self._period(row, ln, roles, ctx)
            self._post(row, roles, ctx)
        return row

    def _post(self, row: SourceRow, roles: dict[str, str], ctx: Ctx) -> None:  # noqa: B027
        pass

    def _period(self, row: SourceRow, ln: RawLine, roles: dict[str, str], ctx: Ctx) -> None:
        pcell = row.cells.get(roles.get("period", ""))
        ycell = row.cells.get(roles.get("year", ""))
        if pcell is None:
            return
        if ycell is not None:  # split year + month columns
            if not pcell.raw.strip() and re.fullmatch(r"\d{4}", ycell.raw.strip()):
                row.period = ycell.raw.strip()  # annual row: month deliberately empty
                return
            try:
                y, m = int(ycell.raw), int(pcell.raw)
                if 1 <= m <= 12:
                    row.period = f"{y}-{m:02d}"
                    return
            except ValueError:
                pass
            ctx.add("PARSER-002", Severity.WARNING, "invalid year/month", "INVALID_DATE", pcell.ref)
            return
        row.period = parse_period(pcell.raw)
        if row.period is None:
            ctx.add(
                "PARSER-002",
                Severity.WARNING,
                f"{pcell.raw!r} is not a recognised date/period",
                "INVALID_DATE",
                pcell.ref,
            )


class LongAdapter(_TabularBase):
    name = "long"
    amount_roles = ("amount",)

    def matches(self, lines: list[RawLine], ctx: Ctx) -> bool:
        header = self._header(lines)
        return header is not None and "amount" in detect_roles([c.strip() for c in header.cells])


class DebitCreditAdapter(_TabularBase):
    name = "debit_credit"
    amount_roles = ("debit", "credit")

    def matches(self, lines: list[RawLine], ctx: Ctx) -> bool:
        header = self._header(lines)
        if header is None:
            return False
        roles = detect_roles([c.strip() for c in header.cells])
        return "debit" in roles and "credit" in roles

    def _post(self, row: SourceRow, roles: dict[str, str], ctx: Ctx) -> None:
        d, c = row.cells[roles["debit"]], row.cells[roles["credit"]]
        if d.value is None and c.value is None:
            ctx.add("PARSER-005", Severity.WARNING, "debit and credit both empty", "BLANK", d.ref)
        elif d.value is not None and c.value is not None:
            ctx.add(
                "PARSER-005", Severity.WARNING, "debit and credit both set", "BOTH_SIDES", d.ref
            )


class WideAdapter:
    """Periods as columns; stacked blocks separated by blank rows; hardcoded subtotals flagged."""

    name = "wide"

    def _period_cols(self, cells: list[str]) -> int:
        return sum(1 for c in cells[1:] if month_from_label(c) or parse_period(c))

    def matches(self, lines: list[RawLine], ctx: Ctx) -> bool:
        header = next((ln for ln in lines if not _is_blank(ln.cells)), None)
        return header is not None and self._period_cols(header.cells) >= 3

    def _is_header(self, cells: list[str], ctx: Ctx) -> bool:
        rest = [c for c in cells[1:] if c.strip()]
        return bool(cells and cells[0].strip() and rest) and all(
            parse_decimal_ex(c, ctx.locale).value is None for c in rest
        )

    def _header_period(self, text: str, ctx: Ctx) -> tuple[str | None, str]:
        if _n(text) == "total":
            return None, "total"
        if (m := month_from_label(text)) is not None:
            return (f"{ctx.hint.default_year}-{m:02d}" if ctx.hint.default_year else None), "month"
        bare = re.sub(r"\s*\([^)]*\)\s*$", "", text).strip()
        if p := parse_period(bare):
            return p, "date"
        if y := re.search(r"\b(19|20)\d{2}\b", text):
            return y.group(0), "year"
        return None, "unknown"

    def parse(self, lines: list[RawLine], ctx: Ctx) -> list[SourceRow]:
        out: list[SourceRow] = []
        headers: list[str] = []
        periods: dict[str, str | None] = {}
        total_cols: set[str] = set()
        block = None
        prev_blank = True
        n_blocks = 0
        for ln in lines:
            if _is_blank(ln.cells):
                out.append(SourceRow(ln.row, "blank", {}, block=block, flags=("blank",)))
                prev_blank = True
                continue
            if prev_blank and self._is_header(ln.cells, ctx):
                n_blocks += 1
                block = f"B{n_blocks}"
                headers = [h.strip() for h in ln.cells]
                ctx.header_rows.append(ln.row)
                if not ctx.headers:
                    ctx.headers = headers
                periods, total_cols = {}, set()
                for i, h in enumerate(headers[1:], start=1):
                    p, kind = self._header_period(h, ctx)
                    periods[h] = p
                    if kind == "total":
                        total_cols.add(h)
                    elif p is None:
                        code = "PERIOD_YEAR_MISSING" if kind == "month" else "UNKNOWN_PERIOD_HEADER"
                        ctx.add(
                            "PARSER-002",
                            Severity.WARNING,
                            f"cannot derive a period for header {h!r}",
                            code,
                            ctx.ref(ln.row, i, h, h),
                        )
                prev_blank = False
                continue
            prev_blank = False
            out.append(self._row(ln, headers, periods, total_cols, block, ctx))
        return out

    def _row(self, ln, headers, periods, total_cols, block, ctx: Ctx) -> SourceRow:
        label = ln.cells[0].strip()
        if _is_note(ln.cells, ctx):
            kind = "note"
        elif _is_blank(ln.cells[1:]):
            kind = "section"
        elif _n(label).startswith(tuple(_n(p) for p in ctx.hint.subtotal_prefixes)):
            kind = "subtotal"
        else:
            kind = "data"
        head0 = headers[0] if headers else "label"
        cells = {head0: _text_cell(ctx, ln.row, 0, head0, ln.cells[0])}
        by_col: dict[str, str | None] = {}
        for i, raw in enumerate(ln.cells[1:], start=1):
            h = headers[i] if i < len(headers) else f"col_{column_letter(i)}"
            if kind in ("note", "section"):
                cells[h] = _text_cell(ctx, ln.row, i, h, raw)
                continue
            cell = _amount_cell(ctx, ln.row, i, h, raw)
            flags = cell.flags
            if h in total_cols:
                flags += ("total_column",)
            if kind == "subtotal":
                flags += ("hardcoded_subtotal",)
            cells[h] = SourceCell(cell.ref, cell.raw, cell.value, flags)
            by_col[h] = periods.get(h)
        return SourceRow(
            ln.row,
            kind,
            cells,
            roles={"label": head0},
            period_by_column=by_col,
            block=block,
            flags=("subtotal",) if kind == "subtotal" else (),
        )


ADAPTERS: dict[str, Adapter] = {
    a.name: a for a in (WideAdapter(), DebitCreditAdapter(), LongAdapter())
}


def select_adapter(lines: list[RawLine], ctx: Ctx) -> Adapter | None:
    """Explicit hint wins; otherwise the first adapter whose structure matches."""
    if ctx.hint.adapter:
        if ctx.hint.adapter not in ADAPTERS:
            raise ValueError(f"unknown adapter {ctx.hint.adapter!r}")
        return ADAPTERS[ctx.hint.adapter]
    return next((a for a in ADAPTERS.values() if a.matches(lines, ctx)), None)
