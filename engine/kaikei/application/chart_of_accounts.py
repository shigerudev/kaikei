"""Group chart of accounts + statement layout: reporting configuration, not code branches.

MANIFESTO §4.2 gives `group_accounts` (`code`, `name`, `statement`, `account_type`,
`normal_balance`, `ic_eligible`) and a statement layout built from them. K1 (the DB) isn't
built yet, so this module is that table as **data**: declarative tuples read by the
reporting layer. Nothing here is an `if account == …` branch, and no company, currency or
file name appears — only the group's own accounts.

TODO(Jordi): this belongs in group configuration next to `entidades.csv` /
`tasas_grupo.csv` (a `cuentas_grupo.csv` + statement layout), loaded the same way as the
rate set. It lives here because `fixtures/` is K7's lane; move it when that file exists and
this module becomes its loader.

**Sign convention** (MANIFESTO §4.2): a canonical amount is signed in its account's normal
balance, so an ordinary revenue *and* an ordinary expense are both positive. That is why
the layout below subtracts cost and expense subtotals (`GROSS_PROFIT = REVENUE −
COST_OF_SALES`) instead of adding them, and it is what reproduces the fixture pack's
figures — verified against `lib/api/preview/snapshot.json`, which was derived from the same
convention.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Literal

from kaikei.domain.normalization.models import Statement

LineKind = Literal["line", "subtotal", "total"]


class NormalBalance(StrEnum):
    DEBIT = "debit"
    CREDIT = "credit"


@dataclass(frozen=True)
class GroupAccount:
    """One postable group account (MANIFESTO §4.2 `group_accounts`)."""

    code: str
    name: str
    statement: Statement
    account_type: str
    normal_balance: NormalBalance
    ic_eligible: bool = False


@dataclass(frozen=True)
class StatementLine:
    """One row of a statement: a posted account, or a subtotal/total over other rows."""

    code: str
    kind: LineKind
    name: str = ""  # computed rows only; a "line" takes its name from GROUP_ACCOUNTS
    components: tuple[tuple[Literal["+", "-"], str], ...] = ()


_PL = Statement.PL
_BS = Statement.BS
_DR = NormalBalance.DEBIT
_CR = NormalBalance.CREDIT

GROUP_ACCOUNTS: tuple[GroupAccount, ...] = (
    GroupAccount("REV_SALES", "Sales", _PL, "revenue", _CR),
    GroupAccount("REV_IC", "Intercompany sales & fees", _PL, "revenue", _CR, ic_eligible=True),
    GroupAccount("COGS", "Cost of sales", _PL, "cost_of_sales", _DR),
    GroupAccount("COGS_IC", "Intercompany purchases", _PL, "cost_of_sales", _DR, ic_eligible=True),
    GroupAccount("SALARIES", "Salaries", _PL, "operating_expense", _DR),
    GroupAccount("RENT", "Rent", _PL, "operating_expense", _DR),
    GroupAccount("MARKETING", "Marketing", _PL, "operating_expense", _DR),
    GroupAccount("DEPRECIATION", "Depreciation", _PL, "operating_expense", _DR),
    GroupAccount(
        "MGMT_FEE_IC", "Management fees (IC)", _PL, "operating_expense", _DR, ic_eligible=True
    ),
    GroupAccount("OTHER_OPEX", "Other operating expenses", _PL, "operating_expense", _DR),
    GroupAccount(
        "INTEREST_INC_IC", "Interest income (IC)", _PL, "finance_income", _CR, ic_eligible=True
    ),
    GroupAccount("INTEREST_EXP", "Interest expense", _PL, "finance_cost", _DR),
    GroupAccount(
        "INTEREST_EXP_IC", "Interest expense (IC)", _PL, "finance_cost", _DR, ic_eligible=True
    ),
    GroupAccount("INCOME_TAX", "Income tax", _PL, "tax", _DR),
    GroupAccount("CASH", "Cash", _BS, "asset", _DR),
    GroupAccount("AR", "Receivables", _BS, "asset", _DR),
    GroupAccount("AR_IC", "Receivables (IC)", _BS, "asset", _DR, ic_eligible=True),
    GroupAccount("INVENTORY", "Inventory", _BS, "asset", _DR),
    GroupAccount("PPE", "Property, plant & equipment", _BS, "asset", _DR),
    GroupAccount("LOAN_IC_REC", "Loan receivable (IC)", _BS, "asset", _DR, ic_eligible=True),
    GroupAccount("AP", "Payables", _BS, "liability", _CR),
    GroupAccount("AP_IC", "Payables (IC)", _BS, "liability", _CR, ic_eligible=True),
    GroupAccount("ST_DEBT", "Short-term debt", _BS, "liability", _CR),
    GroupAccount("LT_DEBT", "Long-term debt", _BS, "liability", _CR),
    GroupAccount("LOAN_IC_PAY", "Loan payable (IC)", _BS, "liability", _CR, ic_eligible=True),
    GroupAccount("EQUITY", "Equity", _BS, "equity", _CR),
)

ACCOUNTS: dict[str, GroupAccount] = {a.code: a for a in GROUP_ACCOUNTS}

PL_LAYOUT: tuple[StatementLine, ...] = (
    StatementLine("REV_SALES", "line"),
    StatementLine("REV_IC", "line"),
    StatementLine("REVENUE", "subtotal", "Revenue", (("+", "REV_SALES"), ("+", "REV_IC"))),
    StatementLine("COGS", "line"),
    StatementLine("COGS_IC", "line"),
    StatementLine("COST_OF_SALES", "subtotal", "Cost of sales", (("+", "COGS"), ("+", "COGS_IC"))),
    StatementLine(
        "GROSS_PROFIT", "total", "Gross profit", (("+", "REVENUE"), ("-", "COST_OF_SALES"))
    ),
    StatementLine("SALARIES", "line"),
    StatementLine("RENT", "line"),
    StatementLine("MARKETING", "line"),
    StatementLine("DEPRECIATION", "line"),
    StatementLine("MGMT_FEE_IC", "line"),
    StatementLine("OTHER_OPEX", "line"),
    StatementLine(
        "OPEX",
        "subtotal",
        "Operating expenses",
        (
            ("+", "SALARIES"),
            ("+", "RENT"),
            ("+", "MARKETING"),
            ("+", "DEPRECIATION"),
            ("+", "MGMT_FEE_IC"),
            ("+", "OTHER_OPEX"),
        ),
    ),
    StatementLine(
        "OPERATING_PROFIT", "total", "Operating profit", (("+", "GROSS_PROFIT"), ("-", "OPEX"))
    ),
    StatementLine("INTEREST_INC_IC", "line"),
    StatementLine("INTEREST_EXP", "line"),
    StatementLine("INTEREST_EXP_IC", "line"),
    StatementLine(
        "NET_FINANCE",
        "subtotal",
        "Net finance result",
        (("+", "INTEREST_INC_IC"), ("-", "INTEREST_EXP"), ("-", "INTEREST_EXP_IC")),
    ),
    StatementLine(
        "PROFIT_BEFORE_TAX",
        "total",
        "Profit before tax",
        (("+", "OPERATING_PROFIT"), ("+", "NET_FINANCE")),
    ),
    StatementLine("INCOME_TAX", "line"),
    StatementLine(
        "NET_PROFIT", "total", "Net profit", (("+", "PROFIT_BEFORE_TAX"), ("-", "INCOME_TAX"))
    ),
)

BS_LAYOUT: tuple[StatementLine, ...] = (
    StatementLine("CASH", "line"),
    StatementLine("AR", "line"),
    StatementLine("AR_IC", "line"),
    StatementLine("INVENTORY", "line"),
    StatementLine("PPE", "line"),
    StatementLine("LOAN_IC_REC", "line"),
    StatementLine(
        "TOTAL_ASSETS",
        "total",
        "Total assets",
        (
            ("+", "CASH"),
            ("+", "AR"),
            ("+", "AR_IC"),
            ("+", "INVENTORY"),
            ("+", "PPE"),
            ("+", "LOAN_IC_REC"),
        ),
    ),
    StatementLine("AP", "line"),
    StatementLine("AP_IC", "line"),
    StatementLine("ST_DEBT", "line"),
    StatementLine("LT_DEBT", "line"),
    StatementLine("LOAN_IC_PAY", "line"),
    StatementLine(
        "TOTAL_LIABILITIES",
        "subtotal",
        "Total liabilities",
        (
            ("+", "AP"),
            ("+", "AP_IC"),
            ("+", "ST_DEBT"),
            ("+", "LT_DEBT"),
            ("+", "LOAN_IC_PAY"),
        ),
    ),
    StatementLine("EQUITY", "line"),
    StatementLine(
        "TOTAL_LIAB_EQUITY",
        "total",
        "Total liabilities & equity",
        (("+", "TOTAL_LIABILITIES"), ("+", "EQUITY")),
    ),
)

LAYOUTS: dict[Statement, tuple[StatementLine, ...]] = {
    Statement.PL: PL_LAYOUT,
    Statement.BS: BS_LAYOUT,
}

# An intercompany flow is named by the *pair of group accounts* its two legs touch — never by
# company, so adding an entity never changes this table (MANIFESTO principle 8).
_IC_FLOW_PAIRS: tuple[tuple[tuple[str, str], str], ...] = (
    (("REV_IC", "COGS_IC"), "Product sales"),
    (("REV_IC", "MGMT_FEE_IC"), "Management fees"),
    (("INTEREST_INC_IC", "INTEREST_EXP_IC"), "Loan interest"),
    (("AR_IC", "AP_IC"), "Receivables / payables"),
    (("LOAN_IC_REC", "LOAN_IC_PAY"), "Intercompany loan"),
)
IC_FLOWS: dict[frozenset[str], str] = {frozenset(pair): label for pair, label in _IC_FLOW_PAIRS}


def account_name(code: str) -> str:
    """Human label for a posted account, a subtotal or a total."""
    account = ACCOUNTS.get(code)
    if account is not None:
        return account.name
    for layout in LAYOUTS.values():
        for line in layout:
            if line.code == code and line.name:
                return line.name
    return code


def statement_of(code: str) -> Statement:
    """Which statement an account belongs to, from the chart — never guessed per call site."""
    account = ACCOUNTS.get(code)
    if account is not None:
        return account.statement
    for statement, layout in LAYOUTS.items():
        if any(line.code == code for line in layout):
            return statement
    return Statement.PL


def flow_label(group_account_codes: list[str] | tuple[str, ...]) -> str:
    """Flow name for an elimination that touches these accounts ("Product sales", …)."""
    return IC_FLOWS.get(frozenset(group_account_codes), "Intercompany")


def period_buckets(period: str, statement: Statement, fiscal_year: str) -> tuple[str, ...]:
    """Reporting periods a record or journal rolls into.

    A P&L month feeds its own month *and* the fiscal year, so "FY 2027" is aggregated by the
    engine from the same translated contributions rather than summed in the browser. A balance
    sheet is a point in time (MANIFESTO §4.2: "records use the period of their closing date"),
    so it rolls into nothing else.
    """
    if statement is Statement.BS:
        return (period,)
    if period.startswith(f"{fiscal_year}-"):
        return (period, fiscal_year)
    return (period,)
