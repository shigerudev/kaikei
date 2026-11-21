# Kaikei — Manifesto

> **What this is:** the single source of truth for what we are building and why. Use it to settle scope arguments. If any other document disagrees with it, this one wins.
> **Detailed spec:** [`PLAN.md`](./PLAN.md) holds the full design: financial rules, the parser requirements, the complete schema and the API list. This manifesto fixes the decisions and contracts; PLAN.md explains them.
> **Companion:** [`SCOPE_AND_TASKS.md`](./SCOPE_AND_TASKS.md) covers the build sequence, owners, the walkthrough and the acceptance checks.
> **Build data:** [`fixtures/grupo-ag/`](../fixtures/grupo-ag/README.md) has six companies, six file formats, three currencies and 13 planted errors with an answer key. The demo must run on the organizers' data once it arrives.
> **Date:** 2026-11-21 · **Track:** Open2 Build & Pitch — Accounting / Grupo AG / *Consolidación multiempresa*.

---

## 0. The one-line promise

**Six companies send six differently shaped budgets in three currencies. Kaikei turns them into one consolidated group budget in a single reporting currency, with no double counting. It catches the planted errors before they reach a total, and it traces every consolidated number back to the exact source file, row and cell.**

Pitch line: *"From six isolated budgets to one consolidated, explainable result: one reporting currency, no double counting, validated errors, and evidence traced all the way to the original cell."*

This is a deterministic, auditable consolidation engine. It is **not** a chatbot over spreadsheets.

---

## 1. Principles (non-negotiable)

1. **The engine calculates.** Every figure comes from deterministic Python code. An LLM is optional and only explains values the engine already computed. It never writes a figure, an adjustment or an FX rate.
2. **Originals are never mutated.** Every file is stored unchanged with its SHA-256. Every source row keeps its raw values and its sheet/row/cell coordinates.
3. **Layers stay separate.** Source → canonical → translated → match → adjustment → consolidated. Each layer is its own table, and no field mixes two of them.
4. **Eliminations are explicit entries.** An intercompany elimination is a balanced journal with its own lineage. It is never a hidden subtraction, and it never overwrites a contribution.
5. **Money is exact.** Use Python `Decimal` and PostgreSQL `NUMERIC`, never floats. Amounts cross JSON as decimal strings. Different currencies are never summed without a recorded, versioned rate.
6. **Nothing uncertain is accepted silently.** No silent dropping, repairing, auto-elimination, or blank-as-zero. Problems become located findings with a severity.
7. **Every number is traceable and reproducible.** A consolidated fact links back to its contributions, rates, matches, journals and source cells. The same inputs and versions always produce the same result, with no duplicate rows or adjustments.
8. **Configuration, not code branches.** Companies, aliases, account mappings, rates and rules are data. No hard-coded six-company or three-currency logic, and no `if GTQ … elif EUR …`.
9. **Narrow and verifiable beats broad and superficial.** Each feature maps to a step in the demo. Anything that doesn't is roadmap.

---

## 2. Product brief: MVP

### Who it is for
A group finance reviewer who receives one budget pack per company and must publish a consolidated group budget they can defend line by line.

### What ships (P0, must work end to end)

| Area | Ships in MVP |
|---|---|
| **Group configuration** | Entities, country, functional currency, ownership %, counterparty aliases (`entidades.csv`), the group rate table (`tasas_grupo.csv`), group parameters (`parametros_grupo.csv`). Reporting currency is **USD** |
| **Ingestion** | Upload one file per company. CSV for the fixtures, plus XLSX through openpyxl if the organizers' data is Excel. Originals kept with SHA-256. Every value keeps file/sheet/row/cell. Handles the six formats: long and wide, Spanish month labels, `dd/mm/yyyy` / `dd-Mon-yyyy` / `YYYY-MM`, decimal comma, semicolons, preamble lines, parentheses negatives, Debit/Credit columns, stacked tables and hardcoded subtotals |
| **Normalization** | Per-company structural and account mappings → canonical records (one company + group account + period + scenario + currency + optional partner + amount + source cell). The reviewer confirms each mapping. Unmapped accounts are findings, never dropped |
| **Validation** | Rule catalog (§4.3) with BLOCKER / WARNING / INFO severity. Target: **13/13** planted errors found, **0** false positives on the fixture pack |
| **FX translation** | Versioned rate set: 2027 average for P&L, 2027-12-31 closing for the balance sheet, 2026 average for 2026 actuals. Local FX assumptions in a file are ignored, and conflicts are reported. A missing rate blocks the result |
| **Intercompany** | A partner is identified only through the alias table, never by amount alone. Pairs are matched per period after conversion, within the group tolerance (USD 1.00). Outcomes: matched, mismatch, one-sided |
| **Consolidation** | Balanced elimination journals for matched pairs (sales ↔ purchases, fees, interest, AR ↔ AP, loans). Consolidated = Σ translated contributions + Σ adjustments, per immutable run |
| **Publication gates** | A run is `DRAFT`, `BLOCKED` or `PUBLISHED`. An open BLOCKER prevents publishing the affected scope. A draft preview is always labelled as such |
| **Inspector** | Click any consolidated number → contributions per company → FX rate used → matches and journals → findings → source file, row and cell with the raw value |
| **Reruns** | The same inputs and versions give the same totals. Fixing a source or approving an exception creates a new run. Published runs are never overwritten |

### Strong additions (P1, if time allows)
- **ROIC, ROCE, EVA:** the fixture pack includes a balance sheet, WACC and tax rates, so these are computable. Show the formula, inputs and periods. Show `INSUFFICIENT_DATA` rather than inventing an input.
- **Variance:** 2027 budget vs 2026 actual, split into operational, FX, elimination and mapping effects. The components must sum exactly to the total.
- **Exception approval:** resolve or approve a finding in the UI, with reviewer and reason, producing a new run.
- **Explanations:** deterministic templates by default. Optional LLM narration over verified facts only.
- **Export:** consolidated budget and audit detail to CSV/XLSX.

### What waits (roadmap, in order)
1. Non-controlling interests, partial ownership, acquisitions/disposals, investment consolidation.
2. Unrealized intercompany profit in inventory or fixed assets; dividends; FX differences on intragroup monetary items.
3. Read-only AI access to published runs over MCP (the former Grok/Claude/ChatGPT goal), returning engine figures with source refs.
4. AI-assisted mapping suggestions with explainable confidence and reviewer approval.
5. Multiple hierarchies and subgroups; approval workflows; SSO/RBAC; multi-tenancy; background workers.
6. ERP/Drive/S3 connectors; incremental reprocessing.

**Never claimed:** certified IFRS statutory reporting. This is management/budget consolidation (PLAN.md §0).

---

## 3. The reviewer's journey

### 3.1 End to end (the demo)

```
Configure group ─▶ Upload 6 packs ─▶ Preview + confirm mappings ─▶ Run
                                                                    │
     ┌──────────────────────────────────────────────────────────────┘
     ▼
 Run status (stages, counts) ─▶ Findings center ─▶ inspect E02 (IC mismatch): both sides, file + row
     │                                 └─▶ approve exception / fix source ─▶ new run
     ▼
 Consolidated dashboard (before/after eliminations) ─▶ click Revenue ─▶ Inspector
     └─▶ rerun same versions ─▶ identical totals          contributions · rate · match · journal · source cell
```

### 3.2 Screens

| # | Screen | Purpose |
|---|---|---|
| 1 | **Group configuration** | Entities, currencies, ownership, aliases, rate set, parameters |
| 2 | **Upload wizard** | One file per company, preview of rows as parsed, mapping confirmation, parse summary |
| 3 | **Run** | Stage progress, records accepted/rejected, finding counts, pinned rate set and rule set |
| 4 | **Findings center** | Filter by severity, rule, company, period. IC mismatches shown side by side. Resolve or approve |
| 5 | **Consolidated dashboard** | P&L and balance per group account, company contributions, eliminations, before/after, publication badge |
| 6 | **Inspector** | The trace for one number (§4.5) |
| 7 | **KPIs + variance** (P1) | Only rendered when inputs exist, otherwise the missing inputs are listed |

Build order for the demo: **upload → findings → dashboard → inspector** first (PLAN.md §14).

### 3.3 Demo scenes (PLAN.md §20)
1. **Input:** six packs, three currencies, normalized per company.
2. **Control:** a planted error (duplicate, IC mismatch, missing rate) is caught before it reaches a total, with file and row.
3. **Reconciliation:** an internal sale is not new group revenue. Show both records, the match, the journal, and before/after revenue.
4. **Inspection:** click consolidated revenue → contributions + adjustments, each rate, rule version, source cell.
5. **Confidence:** rerun with the same versions → identical totals. A correction makes a new, explainable version.
6. **Analytics (P1):** ROIC/ROCE/EVA and the variance waterfall, or the missing inputs listed honestly.

---

## 4. Data flow: source cell → consolidated fact

```
 ① SOURCE        ② CANONICAL         ③ TRANSLATED       ④ MATCH            ⑤ ADJUSTMENT          ⑥ CONSOLIDATED
 source_files ─▶ canonical_records ─▶ translated_records ─▶ match_groups ─▶ adjustment_journals ─▶ consolidated_facts
 source_rows     (mapping version)    (fx_rate_id)          match_members     adjustment_lines       (run_id)
 (sheet/row/cell)                                                              journal_sources
        └──────────────── validation_findings at every stage · lineage back to the source cell ────────────────┘
```

### 4.1 Stages and gates

| Stage | What happens | Gate (on failure) |
|---|---|---|
| ① Ingest | Store original + SHA-256; detect layout; extract rows with sheet/row/cell; same hash in the same group = already imported | Unsafe or unreadable file → reject that file |
| ② Normalize | Structural mapping (header row, columns, wide → long, preamble skip, Debit/Credit → signed) and account mapping (local code → group account, type, normal balance, sign multiplier) | Missing or ambiguous mapping → BLOCKER for the affected records |
| ③ Validate | Rule catalog §4.3 on canonical records | BLOCKERs stop publication of the affected scope |
| ④ Translate | `amount_group = amount_local × rate` with the pinned rate set, by statement and scenario (§4.2) | Missing rate or wrong direction → BLOCKER |
| ⑤ Match IC | Partner resolved through aliases; reciprocal pairs per period after conversion; tolerance from parameters; one record in at most one auto-match | Mismatch / one-sided → finding; that pair is not eliminated |
| ⑥ Eliminate | One balanced journal per matched pair and run, with source records, rule and version | Unbalanced or duplicate journal → BLOCKER |
| ⑦ Aggregate + publish | Facts per run = contributions + adjustments; final checks; run fingerprint | Open BLOCKER → run stays `DRAFT`/`BLOCKED` |

**Run statuses:** `CREATED`, `RUNNING`, `DRAFT`, `BLOCKED`, `READY_FOR_REVIEW`, `PUBLISHED`, `FAILED`. **Finding statuses:** `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `ACCEPTED_RISK`, `SUPERSEDED`. Reconciliation status is separate from record stage (PLAN.md §5.1).

### 4.2 Core data model (PostgreSQL)

MVP tables. The complete list with all fields is in PLAN.md §10.1.

| Table | Key fields |
|---|---|
| `groups` | `id`, `name`, `reporting_currency` |
| `companies` | `id`, `group_id`, `name`, `country`, `functional_currency`, `ownership_pct`, `consolidation_method` |
| `company_aliases` | `company_id`, `alias` — `UNIQUE(group_id, normalized alias)` |
| `scenarios` | `id`, `code` (`BUDGET_2027`, `ACTUAL_2026`), `fiscal_year` |
| `source_files` | `id`, `group_id`, `company_id`, `filename`, `sha256`, `stored_uri`, `uploaded_at` — `UNIQUE(group_id, sha256)` |
| `source_rows` | `id`, `source_file_id`, `sheet`, `row_number`, `raw jsonb`, `cell_refs jsonb` — append-only |
| `group_accounts` | `id`, `code`, `name`, `statement (PL \| BS)`, `account_type`, `normal_balance`, `ic_eligible` |
| `account_mappings` | `company_id`, `local_code`, `group_account_id`, `sign_multiplier`, `version` |
| `canonical_records` | `id`, `source_row_id`, `source_cell`, `company_id`, `scenario_id`, `period (YYYY-MM)`, `group_account_id`, `amount_local NUMERIC(20,4)`, `currency`, `partner_company_id`, `mapping_version` |
| `fx_rate_sets` / `fx_rates` | `rate_set_id`, `from_ccy`, `to_ccy`, `period`, `rate_type (average \| closing)`, `rate NUMERIC(20,10)` = units of `to_ccy` per 1 `from_ccy`, `source` |
| `consolidation_runs` | `id`, `group_id`, `scenario_id`, `rate_set_id`, `rule_set_version`, `mapping_version`, `fingerprint`, `status`, `created_at` |
| `translated_records` | `run_id`, `canonical_record_id`, `fx_rate_id`, `amount_group NUMERIC(20,4)` — `UNIQUE(run_id, canonical_record_id)` |
| `match_groups` / `match_members` | `run_id`, `mode (transaction \| aggregate)`, `status`, `difference`, `tolerance`, `rule_version`; members with `side` |
| `adjustment_journals` / `adjustment_lines` / `journal_sources` | journal per matched pair and run; lines with `debit`/`credit NUMERIC`; links to source records — `UNIQUE(run_id, match_group_id)` |
| `validation_findings` / `finding_events` | `run_id`, `rule_id`, `rule_version`, `severity`, `status`, `affected_record_ids`, amounts, `context jsonb`; events with actor, action, reason, resulting run |
| `consolidated_facts` | `run_id`, `group_account_id`, `period`, `amount_group NUMERIC(20,4)` |

**Conventions.**
- **Sign:** a canonical amount is signed in its account's **normal balance**, so a normal revenue or expense is positive and a contra entry is negative. Statement, type and normal balance drive aggregation. Debit/Credit files (EMP6) and parentheses (EMP4) are converted at normalization.
- **FX policy:** P&L uses the period's average rate, the balance sheet uses the closing rate, and the 2026 actuals use the 2026 average.
- **Rounding:** Decimal precision is kept internally. Round half-even to the currency's decimals only at the reporting boundary.
- **Balance sheet:** records use the period of their closing date (`2027-12`).

### 4.3 Validation rule catalog (MVP)

Rule IDs follow PLAN.md §9.1. Rules VAL-019 to VAL-024 are added for traps the fixture pack plants. **Planted** maps each rule to its `answer_key_errors.csv` IDs.

| Rule | Detects | Default severity | Planted |
|---|---|---|---|
| `VAL-002` | Invalid or missing monetary value | BLOCKER | — |
| `VAL-003` | Account not in the company's mapping | BLOCKER | E07 |
| `VAL-004` | Unknown currency or required FX rate absent | BLOCKER | — |
| `VAL-006` | Duplicate record (same company, account, period, amount, description) | WARNING, counted once | E01 |
| `VAL-007` | Intercompany one-sided: partner record missing | WARNING, not eliminated | E08 |
| `VAL-008` | Intercompany amount difference above tolerance | WARNING, not eliminated | E02 |
| `VAL-010` | Source subtotal ≠ sum of its components | BLOCKER; recompute from components | E03 |
| `VAL-013` | Unbalanced or duplicate elimination journal | BLOCKER | — |
| `VAL-014` | KPI input missing (capital, tax, WACC) | KPI blocked only | — |
| `VAL-016` | Unknown sign convention for a source | BLOCKER | — |
| `VAL-019` | Sign anomaly against the normal balance (e.g. negative revenue) | WARNING | E04 |
| `VAL-020` | Missing period: an account has fewer than 12 months; never assumed zero | WARNING | E05 |
| `VAL-021` | Row currency ≠ the entity's functional currency | BLOCKER | E06 |
| `VAL-022` | Number format disagrees with the file's locale (dot decimal in a comma-decimal file) | WARNING; parse by locale | E09 |
| `VAL-023` | Balance sheet does not balance (assets ≠ liabilities + equity) | BLOCKER for that entity's balance | E10 |
| `VAL-024` | Local FX assumption in a file conflicts with the group rate set | INFO; group rate used | E11a–c |

**Acceptance:** the fixture pack yields exactly the 13 planted findings at their stated locations, and nothing else.

### 4.4 API contract (FastAPI, REST, read and write)

Every mutation validates versioned references. `run_id` identifies a whole reporting snapshot. Amounts are decimal strings. The full list is in PLAN.md §13.

| Verb | Endpoint | Does |
|---|---|---|
| `POST` | `/api/v1/files` | Upload originals, identify company and repeats |
| `GET` | `/api/v1/files/{id}/preview` | Parsed rows, detected layout, parse warnings |
| `POST` | `/api/v1/mappings` · `/{id}/approve` | Draft and freeze a mapping version |
| `POST` | `/api/v1/consolidations` | Start a run with explicit files, mapping, rate set, rule set |
| `GET` | `/api/v1/consolidations/{run_id}` | Status, stages, counts, blocking findings |
| `GET` | `/api/v1/consolidations/{run_id}/facts` | Consolidated facts |
| `GET` | `/api/v1/consolidations/{run_id}/reconciliations` | IC matches, mismatches, one-sided |
| `GET` | `/api/v1/consolidations/{run_id}/findings` | Filterable findings |
| `POST` | `/api/v1/findings/{id}/decisions` | Resolve or approve (a new run when inputs change) |
| `GET` | `/api/v1/facts/{fact_id}/lineage` | Contributions, rates, matches, journals, source cells |
| `POST` | `/api/v1/consolidations/{run_id}/publish` | Freeze an approved snapshot |
| `GET` | `/api/v1/consolidations/{run_id}/kpis` · `/api/v1/variances` | P1 |

The Next.js app talks only to this API. It never computes a financial number.

### 4.5 AI rules

1. AI is optional. With AI switched off, every flow works: mapping is reviewed by hand, and explanations come from deterministic templates.
2. The model receives **read-only, verified structured facts**: computed figures, components and source refs. It returns structured output only, gets no tools, and can't change arithmetic, create an adjustment or invent a cause.
3. File content is quoted data, never instructions.
4. Anything AI-suggested (a mapping, a narration) is labelled as such and needs reviewer approval before it affects a run.

---

## 5. Decisions log

### 5.1 Proposed by Jose, confirmed by the team, 2026-11-21

| # | Decision | Replaces | Why |
|---|---|---|---|
| D1 | **Product = Grupo AG multi-company consolidation** (this document, from PLAN.md) | Single-business owner workspace with consolidation as phase 2 (old C1) | The track is *Consolidación multiempresa*, and the six-company fixture pack is already on main |
| D2 | **Backend = Python (FastAPI + Pydantic, SQLAlchemy + Alembic, `Decimal`, openpyxl/pandas); UI = Next.js + TypeScript** | TypeScript full-stack on Vercel (old C3) | Data handling and parsing are easier in Python, which matters for six formats and exact decimals |
| D3 | **Money = `Decimal` + `NUMERIC`** | `bigint` minor units | FX translation and rates need fractional precision; Decimal keeps it exact |
| D4 | **Publication gates and immutable runs** | "No publish gates, live figures" (old C7) | A group budget is published and defended, unlike a live owner view |
| D5 | **PDF bill evidence and the MCP endpoint leave the MVP** (MCP → roadmap §2, item 3) | Owner-workspace features | Not in the track's deliverables; time goes to consolidation |
| D6 | **CSV and XLSX ingestion** | CSV only (old C6) | Fixtures are CSV; the organizers' data may be Excel |

### 5.2 Carried over (still true)
- Originals are append-only with a hash, repeats are recognized, and nothing uncertain is accepted silently (old principles 3–5).
- Matching is evidence and elimination is a separate financial action (PLAN ADR-005).
- AI never produces a figure, and every AI call can be switched off.
- Golden numbers are hand-computed, never copied from engine output.

### 5.3 Open questions for the organizers (PLAN.md §18.1)
Is the data transaction-level or summary balances? Is there a group chart of accounts? What are the official reporting currency and FX policy? Are KPI inputs provided? Which planted error classes are expected? Must every mismatch be resolved before publishing?

---

## 6. Later phases: how they plug in

1. **Ownership:** `companies.ownership_pct` and `consolidation_method` are stored now (all 100%, full consolidation). NCI and the equity method add rules, not schema changes.
2. **Unrealized profit:** needs inventory data. It is flagged as out of scope until then, never ignored silently.
3. **MCP / AI clients:** a read-only layer over `consolidated_facts` and `/lineage` of **published** runs. Answers quote engine numbers and source refs.
4. **Scale:** a worker per `run_id` and chunked extraction. Lineage stays relational (PLAN.md §10.2).

---

## 7. Glossary

- **Entity / company:** one member of the group, with its own functional currency and file.
- **Group account:** the common chart-of-accounts line that local accounts map to.
- **Canonical record:** one company + group account + period + scenario + currency + amount, with its source cell.
- **Contribution:** a canonical record translated into the reporting currency in a run.
- **Intercompany (IC) pair:** reciprocal records between two group companies, identified through the alias table.
- **Elimination journal:** a balanced adjustment that removes a matched IC pair from the group figure.
- **Run:** an immutable execution pinned to files, mapping, rate set and rule set, identified by its fingerprint.
- **Finding:** a rule result with severity, location and status. A BLOCKER prevents publishing its scope.
- **Source cell:** file + sheet + row + column (e.g. `04_AG_Panama.csv!E32`), the end of every trace.
