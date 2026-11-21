# Grupo AG (fictitious): consolidation e2e fixtures

Mock pack for the **Accounting: Consolidación multiempresa** track (open2 Build & Pitch). One group, six companies, six file formats, three currencies, 13 errors planted on purpose. All companies, accounts, amounts and rates are invented. **The demo must run on the organizers' data; this pack exists to build and test until it arrives.**

Integrity check: `npm run fixtures:check` (asserts 13/13 planted errors at the stated locations and **zero** unplanted defects). Run it after any edit here.

## Files

| File | Purpose |
|---|---|
| `01`–`06_*.csv` | One budget pack per company: monthly 2027 budget (P&L), 31-Dec-2027 balance sheet, 2026 actual totals (variance base) |
| `entidades.csv` | Group config: entity, country, currency, file, format, ownership %, counterparty aliases |
| `tasas_grupo.csv` | The group's single rate table: 2027 average (P&L), 2027-12-31 closing (balance), 2026 average (actuals). USD is the reporting currency |
| `parametros_grupo.csv` | WACC, tax rates per country and IC match tolerance (inputs to ROIC / ROCE / EVA and matching) |
| `answer_key_mapping.csv` | Expected mapping of every local account → group account + type + counterparty |
| `answer_key_errors.csv` | The 13 planted errors with file and line. Target for the validator: 13/13 |

All files are UTF-8 CSV, so they fit the CSV-only ingest (MANIFESTO §2 keeps XLSX out of MVP scope).

## Six formats

| ID | Company | Ccy | Format traps |
|---|---|---|---|
| EMP1 | AG Distribución (GT) | GTQ | Long; Spanish month labels `ene-2027`; `Escenario` = Presupuesto / Real / Balance; trailing `Nota` row |
| EMP2 | AG Manufactura (GT) | GTQ | Wide (months as columns), no account codes, section headers, hardcoded subtotals, three tables stacked in one file |
| EMP3 | AG El Salvador | USD | Long; dot decimal; `YYYY-MM`; P&L and balance in one file |
| EMP4 | AG Panamá | USD | Amounts as quoted text `"(14,000.00)"`, expenses in parentheses, `dd/mm/yyyy` |
| EMP5 | AG España | EUR | Semicolon; decimal comma `1.234,56`; 2 preamble lines before the header; Spanish PGC codes |
| EMP6 | AG Holding (PA) | USD | English GL; Debit / Credit columns; `dd-Mon-yyyy` month-end dates |

Sign conventions differ by file on purpose: EMP1/2/3/5 store everything positive, EMP4 uses parentheses for expenses, EMP6 uses Debit/Credit.

## Intercompany flows (must be eliminated)

| Flow | Seller → Buyer | Seller books | Buyer books |
|---|---|---|---|
| Product sales | EMP2 → EMP1 | GTQ "Ventas a AG Distribución" | GTQ 5102 "Compras a AG Manufactura" |
| Product sales | EMP2 → EMP3 | GTQ = USD × group rate | USD 50-02, counterparty `AGM-GT` |
| Management fees | EMP6 → EMP1, EMP3, EMP4, EMP5 | USD 15,000/month each (Credit) | Local currency at the group rate (GTQ 116,250 / USD 15,000 / EUR 13,888.89) |
| Loan interest | EMP6 → EMP4 | USD 4,000/month interest income | USD 4,000/month interest expense |
| Balances | EMP2 ↔ EMP1 | AR related 600,000 GTQ | AP related 600,000 GTQ |
| Balances | EMP6 ↔ EMP4 | Loan receivable 500,000 USD | Loan payable 500,000 USD |

2026 actual pairs reconcile at the 2026 average rate (GTQ 7.80, EUR 1.06). Counterparties are marked inconsistently on purpose (column in some files, only in the account name in others; codes `EMP1`, `AGM-GT`, `Holding`, `AG HOLDING`, `AG-HOLD`). `entidades.csv` holds the alias table.

## Planted errors

| Type | Count | IDs |
|---|---|---|
| Duplicate row | 1 | E01 |
| Intercompany amount mismatch (transposed digits) | 1 | E02 |
| Subtotal does not match components | 1 | E03 |
| Reversed sign | 1 | E04 |
| Missing month | 1 | E05 |
| Wrong currency for entity | 1 | E06 |
| Unmapped account | 1 | E07 |
| Intercompany one-sided (missing on buyer side) | 1 | E08 |
| Number-format / locale mismatch | 1 | E09 |
| Balance sheet does not balance | 1 | E10 |
| Conflicting local FX assumptions | 3 | E11a–c |

## Provenance

Converted from the team's `grupo-ag-mock` pack (3 XLSX + 2 CSV + rate table). The 2027 budget figures and all 13 planted errors were kept. What changed:
- XLSX → CSV. Each file keeps its format quirks, and the EMP1, EMP2 and EMP4 budget rows keep their original row numbers.
- Fixed unplanted defects. In the source, the 2026 actual intercompany pairs did not reconcile (7 pairs). The buyer-side amounts were corrected to match the seller at the 2026 rate.
- Filled gaps: 2026 average rates (needed for variance and the FX-effect split), `parametros_grupo.csv` (needed for EVA) and `entidades.csv` (group config + alias table).
