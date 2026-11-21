#!/usr/bin/env python3
"""
Build the UI preview snapshot (owner: Jordi) from fixtures/grupo-ag.

This is NOT the engine and NOT golden data. It is a small, readable stand-in so the Next.js screens can
be designed and demoed before the FastAPI engine is reachable. It parses the six packs' 2027 budget and
balance rows, maps them with answer_key_mapping.csv, translates with tasas_grupo.csv, matches the
intercompany flows and writes snapshot.json shaped like the engine API (MANIFESTO §4.4).

Golden numbers stay hand-computed in fixtures/grupo-ag/golden.json (SCOPE §2.1); never copy from here.
Findings come verbatim from answer_key_errors.csv. Decimal arithmetic throughout.

Run: python3 lib/api/preview/build_snapshot.py
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import defaultdict
from decimal import ROUND_HALF_EVEN, Decimal, getcontext
from pathlib import Path

getcontext().prec = 34
ROOT = Path(__file__).resolve().parents[3]
FX = ROOT / "fixtures" / "grupo-ag"
OUT = Path(__file__).with_name("snapshot.json")

Q4 = Decimal("0.0001")
D = Decimal


def q(v: Decimal) -> str:
    return str(v.quantize(Q4, rounding=ROUND_HALF_EVEN))


# ── Group config ─────────────────────────────────────────────────────────────

entities = list(csv.DictReader(open(FX / "entidades.csv", encoding="utf-8")))
COMPANY = {e["entity"]: e for e in entities}
FUNC_CCY = {e["entity"]: e["currency"] for e in entities}

Q4 = Decimal("0.0001")
rates_rows = list(csv.DictReader(open(FX / "tasas_grupo.csv", encoding="utf-8")))
# Rate = USD per 1 unit, derived from units_per_usd for full precision (7.75 → 0.1290322581).
RATES = {}
for r in rates_rows:
    if r["currency"] == "USD":
        continue
    # Use whichever side of the quote is exact: EUR is quoted 1.08 USD/EUR, GTQ is quoted 7.75 GTQ/USD.
    usd_per = D(r["usd_per_unit"])
    exact_usd_per = usd_per == usd_per.quantize(Q4)
    rate = usd_per if exact_usd_per else (D(1) / D(r["units_per_usd"])).quantize(Decimal("0.0000000001"))
    RATES[(r["currency"], r["rate_type"], r["period"])] = {
        "id": f"FX-{r['currency']}-{r['rate_type'][:3].upper()}-{r['period'][:4]}",
        "from_ccy": r["currency"],
        "to_ccy": "USD",
        "period": r["period"],
        "rate_type": r["rate_type"],
        "rate": str(rate),
        "units_per_usd": r["units_per_usd"],
        "source": r["source"],
        "applies_to": r["applies_to"],
    }

params = list(csv.DictReader(open(FX / "parametros_grupo.csv", encoding="utf-8")))
TOLERANCE = D(next(p["value"] for p in params if p["parameter"] == "ic_match_tolerance"))

mapping_rows = list(csv.DictReader(open(FX / "answer_key_mapping.csv", encoding="utf-8")))
MAP = {(m["entity"], m["local_account"].strip()): m for m in mapping_rows}
MAP_BY_NAME = {(m["entity"], m["local_name"].strip()): m for m in mapping_rows}

errors = list(csv.DictReader(open(FX / "answer_key_errors.csv", encoding="utf-8")))


def norm_alias(v: str) -> str:
    import unicodedata
    v = unicodedata.normalize("NFD", v).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", v)


# Partner resolution goes through the alias table only, never by amount (MANIFESTO §2 Intercompany).
ALIASES = {norm_alias(a): e["entity"] for e in entities for a in e["aliases"].split("|") + [e["entity"]]}


def resolve_partner(raw: str | None) -> str | None:
    return ALIASES.get(norm_alias(raw)) if raw else None

REVENUE_ACCTS = {"REV_SALES", "REV_IC", "INTEREST_INC_IC"}
ACCOUNT_NAMES = {
    "REV_SALES": "Ventas", "REV_IC": "Ventas y cargos intercompañía", "COGS": "Costo de ventas", "COGS_IC": "Compras intercompañía",
    "SALARIES": "Salarios", "RENT": "Arrendamientos", "MARKETING": "Mercadeo", "DEPRECIATION": "Depreciación",
    "MGMT_FEE_IC": "Honorarios de gestión (IC)", "OTHER_OPEX": "Otros gastos operativos", "INTEREST_INC_IC": "Ingresos por intereses (IC)",
    "INTEREST_EXP": "Gastos por intereses", "INTEREST_EXP_IC": "Gastos por intereses (IC)", "INCOME_TAX": "Impuesto sobre la renta",
    "CASH": "Efectivo", "AR": "Cuentas por cobrar", "AR_IC": "Cuentas por cobrar (IC)", "INVENTORY": "Inventarios", "PPE": "Propiedad, planta y equipo",
    "LOAN_IC_REC": "Préstamo por cobrar (IC)", "AP": "Cuentas por pagar", "AP_IC": "Cuentas por pagar (IC)", "ST_DEBT": "Deuda a corto plazo",
    "LT_DEBT": "Deuda a largo plazo", "LOAN_IC_PAY": "Préstamo por pagar (IC)", "EQUITY": "Patrimonio",
}
MONTHS_ES = {m: i + 1 for i, m in enumerate(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"])}
MONTHS_EN = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def parse_num(raw: str, locale: str = "dot") -> Decimal:
    s = raw.strip().replace('"', "")
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    if locale == "comma":
        # Decimal comma file. VAL-022: a lone dot with 2 decimals is a dot-decimal number (E09).
        if "," not in s and re.fullmatch(r"\d+\.\d{2}", s):
            pass
        else:
            s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    v = D(s)
    return -v if neg else v


records: list[dict] = []
held_back: dict[str, str] = {}  # record id → finding id (excluded from facts)
previews: dict[str, dict] = {}
file_meta: dict[str, dict] = {}
rid = 0


def add(company, account_local, name, month, amount, currency, filename, line, col, raw, scenario="BUDGET_2027", statement="PL"):
    global rid
    m = MAP.get((company, account_local)) or MAP_BY_NAME.get((company, name))
    rid += 1
    rec = {
        "id": f"REC-{rid:05d}",
        "company_id": company,
        "local_account": account_local or name,
        "local_name": name,
        "group_account": m["group_account"] if m else None,
        "partner_company_id": resolve_partner(m["counterparty"]) if m else None,
        "period": f"2027-{month:02d}",
        "statement": statement,
        "amount_local": amount,
        "currency": currency,
        "scenario": scenario,
        "source": {"file_id": f"FILE-{company}", "filename": filename, "sheet": None, "row": line, "column": col, "cell": f"{filename}!{col}{line}", "raw": raw},
    }
    records.append(rec)
    pv = previews.setdefault(company, {"rows": []})
    if len(pv["rows"]) < 14:
        pv["rows"].append(rec)
    return rec


def normal(group_account: str | None, signed_credit_minus_debit: Decimal) -> Decimal:
    """Sign in the account's normal balance (MANIFESTO §4.2)."""
    if group_account is None:
        return signed_credit_minus_debit
    t = TYPE.get(group_account, "PL")
    credit_normal = group_account in REVENUE_ACCTS or t in ("BS_LIAB", "BS_EQUITY")
    return signed_credit_minus_debit if credit_normal else -signed_credit_minus_debit


TYPE = {m["group_account"]: m["type"] for m in mapping_rows}


def lines(path: Path):
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


# EMP1 — long, Spanish month labels, Escenario column
f = "01_AG_Distribucion_GT.csv"
for i, row in enumerate(csv.reader(lines(FX / f)), start=1):
    if i == 1 or len(row) < 5:
        continue
    mes, cuenta, desc, monto, esc = row[:5]
    if esc == "Presupuesto":
        mm = MONTHS_ES[mes.split("-")[0]]
        add("EMP1", cuenta, desc, mm, parse_num(monto), "GTQ", f, i, "D", monto)
    elif esc == "Balance":
        add("EMP1", cuenta, desc, 12, parse_num(monto), "GTQ", f, i, "D", monto, statement="BS")

# EMP2 — wide, stacked blocks, subtotals skipped (only mapped names are components)
f = "02_AG_Manufactura_GT.csv"
block = None
for i, row in enumerate(csv.reader(lines(FX / f)), start=1):
    if not row or not row[0]:
        continue
    head = row[0]
    if head == "Concepto" and len(row) > 2 and row[1] == "Ene":
        block = "budget"
        continue
    if head == "Rubro":
        block = "balance"
        continue
    if head == "Concepto":
        block = "actual"
        continue
    if (("EMP2", head) not in MAP_BY_NAME):
        continue
    if block == "budget":
        for mi in range(12):
            val = row[1 + mi]
            if val:
                add("EMP2", "", head, mi + 1, parse_num(val), "GTQ", f, i, COLS[1 + mi], val)
    elif block == "balance":
        add("EMP2", "", head, 12, parse_num(row[1]), "GTQ", f, i, "B", row[1], statement="BS")

# EMP3 — long, YYYY-MM, dot decimal
f = "03_AG_ElSalvador.csv"
for i, row in enumerate(csv.reader(lines(FX / f)), start=1):
    if i == 1 or len(row) < 8:
        continue
    periodo, codigo, cuenta, tipo, moneda, valor, contra, esc = row[:8]
    if not periodo.startswith("2027"):
        continue
    mm = int(periodo[5:7])
    stmt = "BS" if tipo != "resultado" else "PL"
    if esc == "presupuesto" or stmt == "BS":
        add("EMP3", codigo, cuenta, mm, parse_num(valor), moneda, f, i, "F", valor, statement=stmt)

# EMP4 — quoted text amounts, parentheses for expenses, dd/mm/yyyy
f = "04_AG_Panama.csv"
for i, row in enumerate(csv.reader(lines(FX / f)), start=1):
    if i == 1 or len(row) < 7:
        continue
    fecha, codigo, nombre, moneda, importe, contra, tipo = row[:7]
    if not fecha.endswith("2027"):
        continue
    mm = int(fecha.split("/")[1])
    stmt = "BS" if tipo == "Balance" else "PL"
    if tipo in ("Presupuesto", "Balance"):
        v = parse_num(importe)
        add("EMP4", codigo, nombre, mm, -v if v < 0 else v, moneda, f, i, "E", importe, statement=stmt)

# EMP5 — semicolon, decimal comma, 2 preamble lines
f = "05_AG_Espana.csv"
for i, line in enumerate(lines(FX / f), start=1):
    if i <= 3 or not line.strip():
        continue
    row = line.split(";")
    ejercicio, mes, cuenta, desc, importe, esc = row[:6]
    if esc == "Presupuesto" and ejercicio == "2027":
        add("EMP5", cuenta, desc, int(mes), parse_num(importe, "comma"), "EUR", f, i, "E", importe)
    elif esc == "Balance":
        add("EMP5", cuenta, desc, 12, parse_num(importe, "comma"), "EUR", f, i, "E", importe, statement="BS")

# EMP6 — English GL, Debit/Credit, dd-Mon-yyyy
f = "06_AG_Holding.csv"
for i, row in enumerate(csv.reader(lines(FX / f)), start=1):
    if i == 1 or len(row) < 7:
        continue
    month, acct, desc, debit, credit, ic, typ = row[:7]
    if not month.endswith("2027"):
        continue
    mm = MONTHS_EN[month.split("-")[1].lower()]
    stmt = "BS" if typ == "Balance" else "PL"
    if typ not in ("Budget", "Balance"):
        continue
    m = MAP.get(("EMP6", acct))
    cmd = (D(credit) if credit else D(0)) - (D(debit) if debit else D(0))
    add("EMP6", acct, desc, mm, normal(m["group_account"] if m else None, cmd), "USD", f, i, "E" if credit else "D", credit or debit, statement=stmt)

# ── Planted-error handling (what the engine would hold back from facts) ─────────

def find_rec(company, filename, line):
    return [r for r in records if r["company_id"] == company and r["source"]["filename"] == filename and r["source"]["row"] == line]

for r in find_rec("EMP1", "01_AG_Distribucion_GT.csv", 52):
    held_back[r["id"]] = "E01"  # duplicate counted once
for r in find_rec("EMP4", "04_AG_Panama.csv", 32):
    held_back[r["id"]] = "E06"  # wrong currency → BLOCKER
for r in records:
    if r["group_account"] is None:
        held_back[r["id"]] = "E07"  # unmapped → BLOCKER

# ── Translation ──────────────────────────────────────────────────────────────

def rate_for(rec):
    if rec["currency"] == "USD":
        return None
    kind = ("closing", "2027-12-31") if rec["statement"] == "BS" else ("average", "2027")
    return RATES[(rec["currency"], kind[0], kind[1])]

for r in records:
    rt = rate_for(r)
    r["rate_id"] = rt["id"] if rt else None
    r["amount_group"] = r["amount_local"] * (D(rt["rate"]) if rt else D(1))

live = [r for r in records if r["id"] not in held_back and FUNC_CCY[r["company_id"]] == r["currency"]]

# ── Intercompany matching ────────────────────────────────────────────────────

PAIRS = [  # (flow, seller acct, buyer acct)
    ("Ventas de producto", "REV_IC", "COGS_IC"),
    ("Honorarios de gestión", "REV_IC", "MGMT_FEE_IC"),
    ("Intereses de préstamo", "INTEREST_INC_IC", "INTEREST_EXP_IC"),
    ("Cuentas por cobrar / pagar", "AR_IC", "AP_IC"),
    ("Préstamo intercompañía", "LOAN_IC_REC", "LOAN_IC_PAY"),
]
side_index = defaultdict(list)
for r in live:
    if r["partner_company_id"]:
        side_index[(r["company_id"], r["partner_company_id"], r["group_account"], r["period"])].append(r)

matches, journals = [], []
mid = jid = 0
seen = set()
for r in live:
    if not r["partner_company_id"]:
        continue
    for flow, sell, buy in PAIRS:
        if r["group_account"] != sell:
            continue
        if flow == "Ventas de producto" and r["company_id"] != "EMP2":
            continue
        if flow == "Honorarios de gestión" and r["company_id"] != "EMP6":
            continue
        key = (r["company_id"], r["partner_company_id"], r["period"], flow)
        if key in seen:
            continue
        seen.add(key)
        buyers = side_index.get((r["partner_company_id"], r["company_id"], buy, r["period"]), [])
        b = buyers[0] if buyers else None
        mid += 1
        diff = abs(r["amount_group"] - b["amount_group"]) if b else r["amount_group"]
        status = "ONE_SIDED" if not b else ("MATCHED" if diff <= TOLERANCE else "MISMATCH")
        mg = {
            "id": f"MATCH-{mid:04d}", "flow": flow, "mode": "transaction", "status": status, "period": r["period"],
            "seller": {"company_id": r["company_id"], "group_account": sell, "record_id": r["id"], "amount_local": q(r["amount_local"]), "currency": r["currency"], "amount_group": q(r["amount_group"]), "source": r["source"]},
            "buyer": ({"company_id": b["company_id"], "group_account": buy, "record_id": b["id"], "amount_local": q(b["amount_local"]), "currency": b["currency"], "amount_group": q(b["amount_group"]), "source": b["source"]} if b else None),
            "difference": q(diff), "tolerance": q(TOLERANCE), "journal_id": None, "finding_id": None,
        }
        if status == "MATCHED":
            jid += 1
            amt = r["amount_group"]
            stmt_bs = flow in ("Cuentas por cobrar / pagar", "Préstamo intercompañía")
            j = {
                "id": f"ELIM-{jid:04d}", "match_group_id": mg["id"], "rule_id": "IC-ELIM-01", "rule_version": "1.0.0", "currency": "USD",
                "period": r["period"], "flow": flow,
                "lines": [
                    {"group_account": sell, "company_id": r["company_id"], "debit": q(amt) if not stmt_bs or sell in ("AP_IC", "LOAN_IC_PAY") else "0.0000", "credit": "0.0000" if not stmt_bs or sell in ("AP_IC", "LOAN_IC_PAY") else q(amt)},
                    {"group_account": buy, "company_id": b["company_id"], "debit": "0.0000" if not stmt_bs or buy not in ("AP_IC", "LOAN_IC_PAY") else q(amt), "credit": q(amt) if not stmt_bs or buy not in ("AP_IC", "LOAN_IC_PAY") else "0.0000"},
                ],
                "source_record_ids": [r["id"], b["id"]],
                "amount_group": q(amt),
            }
            journals.append(j)
            mg["journal_id"] = j["id"]
        matches.append(mg)

# Buyer-side records without a seller (none expected) are ignored for the preview.

# ── Facts ────────────────────────────────────────────────────────────────────

PL_LINES = ["REV_SALES", "REV_IC", "COGS", "COGS_IC", "SALARIES", "RENT", "MARKETING", "DEPRECIATION", "MGMT_FEE_IC", "OTHER_OPEX", "INTEREST_INC_IC", "INTEREST_EXP", "INTEREST_EXP_IC", "INCOME_TAX"]
PL_LAYOUT = [
    ("REVENUE", "Ingresos", [("+", "REV_SALES"), ("+", "REV_IC")]),
    ("COST_OF_SALES", "Costo de ventas total", [("+", "COGS"), ("+", "COGS_IC")]),
    ("GROSS_PROFIT", "Utilidad bruta", [("+", "REVENUE"), ("-", "COST_OF_SALES")]),
    ("OPEX", "Gastos operativos", [("+", a) for a in ["SALARIES", "RENT", "MARKETING", "DEPRECIATION", "MGMT_FEE_IC", "OTHER_OPEX"]]),
    ("OPERATING_PROFIT", "Utilidad operativa", [("+", "GROSS_PROFIT"), ("-", "OPEX")]),
    ("NET_FINANCE", "Resultado financiero neto", [("+", "INTEREST_INC_IC"), ("-", "INTEREST_EXP"), ("-", "INTEREST_EXP_IC")]),
    ("PROFIT_BEFORE_TAX", "Utilidad antes de impuestos", [("+", "OPERATING_PROFIT"), ("+", "NET_FINANCE")]),
    ("NET_PROFIT", "Utilidad neta", [("+", "PROFIT_BEFORE_TAX"), ("-", "INCOME_TAX")]),
]
PL_ORDER = [
    ("REV_SALES", "line"), ("REV_IC", "line"), ("REVENUE", "subtotal"),
    ("COGS", "line"), ("COGS_IC", "line"), ("COST_OF_SALES", "subtotal"), ("GROSS_PROFIT", "total"),
    ("SALARIES", "line"), ("RENT", "line"), ("MARKETING", "line"), ("DEPRECIATION", "line"), ("MGMT_FEE_IC", "line"), ("OTHER_OPEX", "line"), ("OPEX", "subtotal"),
    ("OPERATING_PROFIT", "total"),
    ("INTEREST_INC_IC", "line"), ("INTEREST_EXP", "line"), ("INTEREST_EXP_IC", "line"), ("NET_FINANCE", "subtotal"),
    ("PROFIT_BEFORE_TAX", "total"), ("INCOME_TAX", "line"), ("NET_PROFIT", "total"),
]
BS_LAYOUT = [
    ("TOTAL_ASSETS", "Total activos", [("+", a) for a in ["CASH", "AR", "AR_IC", "INVENTORY", "PPE", "LOAN_IC_REC"]]),
    ("TOTAL_LIABILITIES", "Total pasivos", [("+", a) for a in ["AP", "AP_IC", "ST_DEBT", "LT_DEBT", "LOAN_IC_PAY"]]),
    ("TOTAL_LIAB_EQUITY", "Total pasivos y patrimonio", [("+", "TOTAL_LIABILITIES"), ("+", "EQUITY")]),
]
BS_ORDER = [
    ("CASH", "line"), ("AR", "line"), ("AR_IC", "line"), ("INVENTORY", "line"), ("PPE", "line"), ("LOAN_IC_REC", "line"), ("TOTAL_ASSETS", "total"),
    ("AP", "line"), ("AP_IC", "line"), ("ST_DEBT", "line"), ("LT_DEBT", "line"), ("LOAN_IC_PAY", "line"), ("TOTAL_LIABILITIES", "subtotal"),
    ("EQUITY", "line"), ("TOTAL_LIAB_EQUITY", "total"),
]
COMPANIES = [e["entity"] for e in entities]
BLOCKED_BS = {"EMP5"}  # E10: balance sheet does not balance → blocked from the consolidated balance

facts, lineage = [], {}


def build(period_label, statement, in_scope, layout, order):
    contrib = defaultdict(lambda: defaultdict(D))
    rec_ids = defaultdict(lambda: defaultdict(list))
    for r in live:
        if r["statement"] != statement or not in_scope(r["period"]) or r["group_account"] is None:
            continue
        contrib[r["group_account"]][r["company_id"]] += r["amount_group"]
        rec_ids[r["group_account"]][r["company_id"]].append(r)
    adj = defaultdict(D)
    adj_js = defaultdict(list)
    for j in journals:
        if not in_scope(j["period"]) or ((j["flow"] in ("Cuentas por cobrar / pagar", "Préstamo intercompañía")) != (statement == "BS")):
            continue
        for ln in j["lines"]:
            acct = ln["group_account"]
            delta = D(ln["credit"]) - D(ln["debit"])
            # adjustments in normal-balance terms: eliminations reduce both sides
            amt = delta if (acct in REVENUE_ACCTS or TYPE.get(acct) in ("BS_LIAB", "BS_EQUITY")) else -delta
            adj[acct] += amt
            adj_js[acct].append(j)
    values = {}
    rows = []
    for code, kind in order:
        name = ACCOUNT_NAMES.get(code) or next(l[1] for l in layout if l[0] == code)
        if kind == "line":
            by_c = {c: contrib[code][c] for c in COMPANIES if contrib[code][c] != 0}
            excluded = {c: v for c, v in by_c.items() if statement == "BS" and c in BLOCKED_BS}
            ctot = sum((v for c, v in by_c.items() if c not in excluded), D(0))
            atot = adj[code]
            values[code] = (ctot, atot, by_c)
        else:
            parts = next(l[2] for l in layout if l[0] == code)
            ctot = sum(((values[p][0] if s == "+" else -values[p][0]) for s, p in parts), D(0))
            atot = sum(((values[p][1] if s == "+" else -values[p][1]) for s, p in parts), D(0))
            by_c = defaultdict(D)
            for s, p in parts:
                for c, v in values[p][2].items():
                    by_c[c] += v if s == "+" else -v
            by_c = dict(by_c)
            values[code] = (ctot, atot, by_c)
        fid = f"FACT-{statement}-{period_label}-{code}"
        row = {
            "id": fid, "group_account": code, "name": name, "statement": statement, "kind": kind, "period": period_label,
            "contributions_total": q(values[code][0]), "adjustments_total": q(values[code][1]), "amount": q(values[code][0] + values[code][1]),
            "by_company": {c: q(v) for c, v in values[code][2].items()},
            "blocked_companies": sorted(BLOCKED_BS) if statement == "BS" else [],
            "components": [p for _, p in next(l[2] for l in layout if l[0] == code)] if kind != "line" else [],
        }
        rows.append(row)
        if kind == "line":
            lineage[fid] = {
                "fact_id": fid, "group_account": code, "name": name, "period": period_label, "statement": statement, "currency": "USD",
                "amount": row["amount"], "contributions_total": row["contributions_total"], "adjustments_total": row["adjustments_total"],
                "contributions": [
                    {
                        "company_id": c,
                        "excluded": statement == "BS" and c in BLOCKED_BS,
                        "currency": rec_ids[code][c][0]["currency"],
                        "amount_local": q(sum((r["amount_local"] for r in rec_ids[code][c]), D(0))),
                        "rate": next((RATES_BY_ID[r["rate_id"]] for r in rec_ids[code][c] if r["rate_id"]), None),
                        "amount_group": q(contrib[code][c]),
                        "records": [{"id": r["id"], "period": r["period"], "amount_local": q(r["amount_local"]), "amount_group": q(r["amount_group"]), "source": r["source"], "local_account": r["local_account"], "local_name": r["local_name"]} for r in rec_ids[code][c]],
                    }
                    for c in COMPANIES if rec_ids[code][c]
                ],
                "adjustments": [
                    {"journal_id": j["id"], "match_group_id": j["match_group_id"], "rule_id": j["rule_id"], "rule_version": j["rule_version"], "flow": j["flow"], "period": j["period"], "amount_group": j["amount_group"], "counterparty": next(l["company_id"] for l in j["lines"] if l["group_account"] != code), "source_record_ids": j["source_record_ids"]}
                    for j in adj_js[code]
                ],
                "finding_ids": [],
            }
    return rows


RATES_BY_ID = {v["id"]: v for v in RATES.values()}
facts_by_period = {
    "2027-01": build("2027-01", "PL", lambda p: p == "2027-01", PL_LAYOUT, PL_ORDER),
    "2027": build("2027", "PL", lambda p: p.startswith("2027"), PL_LAYOUT, PL_ORDER),
    "2027-12-BS": build("2027-12", "BS", lambda p: p == "2027-12", BS_LAYOUT, BS_ORDER),
}
for m in range(2, 13):
    facts_by_period[f"2027-{m:02d}"] = build(f"2027-{m:02d}", "PL", lambda p, m=m: p == f"2027-{m:02d}", PL_LAYOUT, PL_ORDER)

# ── Findings (verbatim from the answer key) ───────────────────────────────────

RULE = {
    "duplicate_row": ("VAL-006", "WARNING", "Registro duplicado"),
    "intercompany_mismatch": ("VAL-008", "WARNING", "Diferencia intercompañía"),
    "subtotal_mismatch": ("VAL-010", "BLOCKER", "Subtotal ≠ componentes"),
    "sign_error": ("VAL-019", "WARNING", "Signo contrario al saldo normal"),
    "missing_period": ("VAL-020", "WARNING", "Mes faltante"),
    "wrong_currency": ("VAL-021", "BLOCKER", "Moneda ≠ moneda de la entidad"),
    "unmapped_account": ("VAL-003", "BLOCKER", "Cuenta sin mapear"),
    "intercompany_one_sided": ("VAL-007", "WARNING", "Intercompañía sin contraparte"),
    "number_format": ("VAL-022", "WARNING", "Formato numérico vs. archivo"),
    "balance_not_balanced": ("VAL-023", "BLOCKER", "Balance no cuadra"),
    "fx_assumption_conflict": ("VAL-024", "INFO", "Tipo de cambio local ignorado"),
}
AMOUNTS = {
    "E02": {"expected": "427500.0000", "observed": "472500.0000", "difference": "45000.0000", "currency": "GTQ"},
    "E03": {"expected": "1809750.0000", "observed": "1859750.0000", "difference": "50000.0000", "currency": "GTQ"},
    "E10": {"expected": "2180000.0000", "observed": "2130000.0000", "difference": "50000.0000", "currency": "EUR"},
    "E06": {"observed": "108500.0000", "currency": "GTQ"},
    "E07": {"observed": "3200.0000", "currency": "USD"},
}


def refs_for(e):
    out = []
    loc = e["location"]
    nums = [int(n) for n in re.findall(r"line (\d+)", loc)] + [int(a) for a, _ in re.findall(r"lines (\d+)-(\d+)", loc)]
    col = (re.search(r"column (\w+)", loc) or [None, None])[1]
    files = [e["file"]]
    for n in nums or [None]:
        out.append({"file_id": f"FILE-{e['entity'][:4]}", "filename": e["file"], "sheet": None, "row": n, "column": col, "cell": f"{e['file']}!{col or ''}{n}" if n else None, "raw": None, "note": None if n else loc})
    m = re.search(r"\((\S+\.csv) line (\d+)(?:, column (\w+))?", e["detail"])
    if m:
        out.append({"file_id": None, "filename": m.group(1), "sheet": None, "row": int(m.group(2)), "column": m.group(3), "cell": f"{m.group(1)}!{m.group(3) or ''}{m.group(2)}", "raw": None, "note": None})
    return out


findings = []
for e in errors:
    rule_id, sev, title = RULE[e["error_type"]]
    f = {
        "id": f"FIND-{e['id']}", "reference": e["id"], "rule_id": rule_id, "rule_version": "1.0.0", "severity": sev, "status": "OPEN",
        "title": title, "error_type": e["error_type"], "company_ids": [c for c in re.findall(r"EMP\d", e["entity"])],
        "reason": e["detail"], "expected_behavior": e["expected_behavior"], "source_refs": refs_for(e),
        **AMOUNTS.get(e["id"], {}), "match_group_id": None, "affects_publication": sev == "BLOCKER",
    }
    findings.append(f)

# Link IC findings to their match groups
for mg in matches:
    if mg["status"] == "MISMATCH" and mg["seller"]["company_id"] == "EMP2" and mg["buyer"] and mg["buyer"]["company_id"] == "EMP1":
        mg["finding_id"] = "FIND-E02"
        next(f for f in findings if f["id"] == "FIND-E02")["match_group_id"] = mg["id"]
    if mg["status"] == "ONE_SIDED" and mg["seller"]["company_id"] == "EMP6" and mg["seller"]["record_id"]:
        if mg["period"] == "2027-12" and mg["flow"] == "Honorarios de gestión":
            mg["finding_id"] = "FIND-E08"
            next(f for f in findings if f["id"] == "FIND-E08")["match_group_id"] = mg["id"]

# ── Files, previews, run ──────────────────────────────────────────────────────

files = []
for e in entities:
    path = FX / e["file"]
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    recs = [r for r in records if r["company_id"] == e["entity"]]
    files.append({
        "id": f"FILE-{e['entity']}", "company_id": e["entity"], "filename": e["file"], "sha256": sha, "uploaded_at": "2026-11-21T15:10:00Z",
        "status": "MAPPING_APPROVED", "format": e["format"], "rows": len(lines(path)), "records": len(recs),
        "parse_warnings": [f["title"] for f in findings if e["entity"] in f["company_ids"] and f["severity"] != "BLOCKER" and f["rule_id"] in ("VAL-022", "VAL-024")],
        "mapping_version": "MAP-V1",
    })

previews_out = {}
for c, pv in previews.items():
    previews_out[c] = {
        "file_id": f"FILE-{c}",
        "rows": [{"source": r["source"], "local_account": r["local_account"], "local_name": r["local_name"], "period": r["period"], "amount_local": q(r["amount_local"]), "currency": r["currency"], "group_account": r["group_account"], "partner_company_id": r["partner_company_id"], "statement": r["statement"]} for r in pv["rows"]],
        "account_mapping": [{"local_code": m["local_account"], "local_name": m["local_name"], "group_account": m["group_account"], "type": m["type"], "partner": m["counterparty"] or None} for m in mapping_rows if m["entity"] == c],
    }

inputs = {"files": [{"company_id": f["company_id"], "filename": f["filename"], "sha256": f["sha256"]} for f in files], "mapping_version": "MAP-V1", "rate_set_id": "FX-BUDGET-2027-V1", "rule_set_version": "RULES-1.0.0"}

counts = {
    "records": len(records), "held_back": len(held_back), "translated": len(live),
    "matched": sum(1 for m in matches if m["status"] == "MATCHED"), "mismatched": sum(1 for m in matches if m["status"] == "MISMATCH"),
    "one_sided": sum(1 for m in matches if m["status"] == "ONE_SIDED"), "journals": len(journals),
}

snapshot = {
    "$comment": "UI preview snapshot generated by lib/api/preview/build_snapshot.py from fixtures/grupo-ag. Not golden data; not engine output.",
    "group": {"id": "demo", "name": "Grupo de ejemplo", "reporting_currency": "USD", "scenario": "BUDGET_2027"},
    "companies": [{"id": e["entity"], "name": e["name"], "country": e["country"], "functional_currency": e["currency"], "ownership_pct": e["ownership_pct"], "consolidation_method": "FULL", "aliases": e["aliases"].split("|"), "filename": e["file"], "format": e["format"]} for e in entities],
    "rate_set": {"id": "FX-BUDGET-2027-V1", "version": "1", "rates": list(RATES.values())},
    "parameters": params,
    "files": files,
    "previews": previews_out,
    "facts": facts_by_period,
    "lineage": lineage,
    "matches": matches,
    "journals": journals,
    "findings": findings,
    "run_inputs": inputs,
    "counts": counts,
}
OUT.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
print(f"wrote {OUT.relative_to(ROOT)}: {len(records)} records, {len(live)} live, {len(matches)} matches ({counts['matched']} matched, {counts['mismatched']} mismatch, {counts['one_sided']} one-sided), {len(journals)} journals, {len(findings)} findings, {OUT.stat().st_size // 1024} KB")
