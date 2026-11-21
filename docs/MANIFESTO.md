# Kaikei — Manifesto

> **What this is:** the single source of truth for what we are building and why. Use it to settle scope arguments.
> **Companion:** [`SCOPE_AND_TASKS.md`](./SCOPE_AND_TASKS.md) covers the build sequence, owners, the walkthrough, and the acceptance checks.
> **Inputs merged:** Jordi's product brief (confirmed decisions); `KAIKEI_discovery_Rou.md` (architecture proposal); `PLAN.md` (consolidation engine proposal); `research-legislacion-tributaria-centroamerica.md` (FX and tax research).
> **Date:** 2026-11-21 · **Build budget:** ~6 hours, from Jordi's latest estimate.

---

## 0. The one-line promise

**A small-business owner can answer "why did this number change?" in one place, then click through to the exact records behind the answer: the CSV row, the bill PDF, and the match between them. Their AI assistant gets the same answer from the same records.**

Pitch line: *"Every number opens down to the row. If we can't trace it, we don't show it."*

---

## 1. Principles (non-negotiable)

1. **The platform calculates and the agent assists.** The AI reads files, proposes column mappings, extracts bill fields, suggests matches, and phrases explanations. It never writes a figure. Every number shown in the app or returned over MCP comes from one deterministic metrics function.
2. **One source of truth, two surfaces.** The dashboard and the MCP endpoint call the same metrics code and return the same `as_of` stamp. If they disagree, that is a bug.
3. **Originals are never mutated.** Every uploaded file is stored unchanged with its SHA-256 hash, and every source row is kept as raw values. Accepted records point back to the row they came from.
4. **Count each transaction once.** Re-importing a file, or a newer export that overlaps an older one, adds no new records. Linking a bill to a transaction adds evidence to it, not a new amount.
5. **Nothing uncertain gets accepted silently.** Ambiguous mappings, low-confidence extractions, and uncertain matches go to review. Unparseable rows become located flags and are never dropped.
6. **Money is exact.** Amounts are stored as integer minor units (`bigint` cents) along with an ISO currency code. Floats are never used. Amounts in different currencies are never summed without an explicit, recorded rate.
7. **Owner-first, not accountant-first.** Use the owner's language ("Deliveries", "over budget", "bill attached"), not journal or ledger terms. Midday's lesson: you recognize a transaction, a document, and the link between them at a glance.
8. **Narrow and verifiable beats broad and superficial.** Each feature maps to a step in the owner's journey. Anything that doesn't is roadmap.

---

## 2. Product brief: first usable release (MVP)

### Who it is for
An owner of a small business with a small team, regular money in and out, and a weekly reason to check finances. There is one business and one primary currency per workspace in the MVP.

### What ships

| Area | Ships in MVP |
|---|---|
| **CSV intake** | Upload a CSV and pick Budget or Actual transactions (the system pre-selects a guess). The platform proposes a column→field mapping (date/period, category/account, amount, currency, description) with original values shown. The owner resolves ambiguous columns. Parse errors become located flags. |
| **Budgets vs actuals** | A budget import sets planned figures per `(period, category, currency)`, and a newer budget for the same key supersedes the old one (history is kept). An actual import adds transactions. Variance = actual − budget for the same period, currency, and category. |
| **Cash flow (minimal)** | Money in and out by month, from actual transactions by their transaction date. Bills and budgets never count as cash. |
| **PDF bills/receipts** | Upload a PDF and see the page beside the extracted supplier, date, currency, and total (editable). Review a suggested match to an existing transaction. Confirming attaches the bill as evidence, so the amount counts once. Uncertain matches stay in review. |
| **Dashboard + evidence** | Company overview for a period, with budget, actual, and variance by category plus cash in/out. A "What changed" panel after each upload shows deltas per figure. Drilldown goes from figure → contributing transactions → original CSV row → linked PDF. A review queue lists flags with their location and reason. |
| **Repeat imports** | Exact file repeats are recognized by hash. Overlapping exports are deduplicated per row by fingerprint. The import summary shows *new / already imported / flagged*. |
| **External AI (MCP)** | One read-only MCP endpoint per workspace. Grok comes first for the live demo; Claude and ChatGPT are compatibility targets. Tools return figures, period, currency, `as_of`, and source references with deep links into the app. |
| **Self-serve trial** | "Try the sample" creates a fresh seeded workspace, offers a downloadable sample CSV and bill PDF, and shows a "Use your own file" path. No coaching needed: the import summary and "What changed" panel explain the result. |

### What waits (roadmap, in order)

1. **Multi-business consolidation** (the Grupo AG–style proposal in `PLAN.md` / Rou's doc; see §6 for the agreed design).
2. Multi-currency within one workspace, using a versioned rate table and an FX effect split in variances.
3. XLSX/multi-sheet ingestion, config-driven per-source loaders, wide→long unpivot.
4. Bank feeds and email-in for receipts; OCR for scanned (image-only) PDFs if MVP extraction can't handle them.
5. Country tax layer (ISR/IVA/minimum-tax references from the CA research): VAT-included detection, NOPAT, cash-tax forecasts.
6. KPIs (ROIC/ROCE/EVA) only once capital, tax, and WACC inputs exist.
7. Accounts, roles, OAuth for MCP, audit log UI, exports.

---

## 3. The owner's journey

### 3.1 End to end

```
Land ─▶ Try sample (seeded workspace) ─▶ Overview
   │                                         │
   │                                         ├─▶ Upload CSV ─▶ choose Budget/Actual ─▶ review mapping ─▶ import summary
   │                                         │                                                         (new / repeat / flagged)
   │                                         │        └──────────────▶ Overview with "What changed" highlights
   │                                         │
   │                                         ├─▶ Click a figure ─▶ contributing transactions ─▶ original CSV row ─▶ linked bill
   │                                         ├─▶ Upload PDF ─▶ page + extracted fields ─▶ confirm match ─▶ transaction shows 📎
   │                                         ├─▶ Review queue ─▶ resolve / dismiss a flag
   │                                         └─▶ Connect AI ─▶ copy MCP URL ─▶ ask Grok / Claude / ChatGPT
   └─▶ "Use your own file" ─▶ empty workspace ─▶ same flow
```

### 3.2 Screens (7)

| # | Screen | Purpose | Midday/Ramp lesson applied |
|---|---|---|---|
| 1 | **Landing / Trial** | One sentence of value, "Try the sample", "Use your own file", sample file downloads | Ramp: state the value in one line, then show it |
| 2 | **Overview** | Period picker; category table with budget, actual, and variance (over budget in red); cash in/out; "What changed since last upload"; review count | Figures are clickable everywhere |
| 3 | **Import wizard** | Upload → type (Budget/Actual) → mapping with raw sample values and confidence → summary → apply | Show the original values next to the proposal |
| 4 | **Figure drilldown** | Figure → list of contributing transactions with their sum shown equal to the figure | Every row is recognizable: date, description, amount, 📎 evidence |
| 5 | **Transaction drawer** | Fields, original CSV row (raw), source file + row number, linked bill thumbnail, match suggestions | Midday: transaction and document side by side |
| 6 | **Document review** | PDF page on the left; extracted supplier, date, currency, and total on the right (editable); suggested match card; Confirm / Not this one | Midday: the relationship is visible, not implied |
| 7 | **Review queue** | Flags with reason, file, row/column, and a link to the record; resolve or dismiss | Exceptions first, not buried |

Plus a small **Connect AI** panel (in settings) showing the MCP URL and copy-paste setup per client.

### 3.3 What a fresh upload changes

| Upload | Changes | Does not change |
|---|---|---|
| **Actual CSV** | Adds new transactions; skips repeats; creates flags; recomputes actual, variance, and cash for affected `(period, category, currency)`; writes a change event shown in "What changed" | Budgets; existing evidence links |
| **Budget CSV** | Supersedes planned figures for matching keys (old version kept); recomputes variance | Transactions, cash |
| **PDF bill** | Creates a document and a match suggestion. Only an owner **confirmation** links it as evidence to a transaction | Any amount. A bill never adds to actual or cash |
| **Repeat file / overlapping export** | Import summary says "N already imported"; only genuinely new rows are added | Totals for already-counted rows |

---

## 4. Data flow: original file → MCP answer

```
 ① ORIGINAL            ② RAW                 ③ PROPOSED            ④ ACCEPTED                 ⑤ FIGURE               ⑥ ANSWER
 source_files  ──▶  source_rows   ──▶   mapping / extraction ──▶ transactions          ──▶ metrics.getVariance() ──▶ App UI
 (blob + sha256)    (raw jsonb,         / match suggestion       budget_lines              metrics.getCashflow()  ──▶ MCP tools
                     row number)        ⚠ REVIEW POINTS          documents                  (one module)             (Grok/Claude/ChatGPT)
                                                                  evidence_links (confirmed)
                                                                  flags
```

### 4.1 Stages

| Stage | What happens | Owner | Agent? | Review point |
|---|---|---|---|---|
| ① Store original | File saved to blob storage with SHA-256. Same hash in the same workspace = "already imported this file" | Backend | — | — |
| ② Raw rows | CSV parsed into `source_rows(file_id, row_number, raw)`, never edited | Backend | — | — |
| ③a Column mapping | Header heuristics first, LLM fallback; each field carries a confidence and sample values | AI | ✅ suggests | **⚠ R1:** owner confirms the mapping; required when any field is < high confidence or two columns compete |
| ③b Type detection | Budget vs Actual guessed from columns (period-only + no dates → budget) | AI/heuristic | ✅ suggests | **⚠ R2:** owner picks/confirms the type before apply |
| ③c Category resolution | Map raw category text to workspace categories (with aliases, e.g. "entregas" ↔ Deliveries) | AI/heuristic | ✅ suggests | **⚠ R3:** new or unknown categories need confirmation, otherwise they are flagged `unmapped_category` |
| ④a Apply | Valid rows → `transactions` / `budget_lines`, each with `source_row_id` + `import_id`. Invalid rows → `flags` with file/row/column + reason | Backend | — | — |
| ④b Dedupe | `fingerprint = hash(date, amount_minor, currency, normalized description, category) + occurrence index within file`; `UNIQUE(workspace_id, fingerprint)` | Backend | — | Possible duplicates across *different* files → flag, still counted |
| ④c PDF extraction | Supplier, date, currency, and total extracted with per-field confidence | AI | ✅ extracts | **⚠ R4:** owner sees the page beside the fields and can edit them |
| ④d Match suggestion | Candidates scored by amount (exact = strong), date window (±7 days), and supplier ~ description/counterparty. Stored as `evidence_links.status = suggested` with reasons | AI/heuristic | ✅ suggests | **⚠ R5:** **only an owner confirmation** sets `confirmed`. One confirmed transaction per document. No auto-confirm in the MVP |
| ④e Flags | Rule catalog runs after each import (see §4.3) | Backend/data | — | Review queue |
| ⑤ Figures | `getVariance(workspace, period, category?, currency)` returns budget, actual, variance, contributing transaction IDs, budget line IDs, and `as_of` (latest applied import ID + timestamp). `getCashflow` likewise | Backend | — | — |
| ⑥ Answer | MCP tools call the ⑤ functions and return numbers plus `source_refs` (transaction IDs, file name + row, document IDs, app deep links). The assistant phrases the answer and never computes | AI/DevOps | ✅ phrases | **⚠ R6:** answers must quote tool numbers; checked by the parity test |

### 4.2 Core data model (Postgres)

| Table | Key fields |
|---|---|
| `workspaces` | `id`, `name`, `base_currency`, `mcp_token`, `is_sample` |
| `source_files` | `id`, `workspace_id`, `kind (csv_budget \| csv_actual \| pdf)`, `filename`, `sha256`, `blob_url`, `uploaded_at` — `UNIQUE(workspace_id, sha256)` |
| `source_rows` | `id`, `file_id`, `row_number`, `raw jsonb` |
| `imports` | `id`, `file_id`, `type`, `mapping jsonb`, `status (proposed \| applied)`, `counts jsonb (new, repeat, flagged)`, `applied_at` |
| `categories` | `id`, `workspace_id`, `name`, `aliases text[]` |
| `transactions` | `id`, `workspace_id`, `date`, `amount_minor bigint` (− = out), `currency`, `category_id`, `description`, `counterparty`, `fingerprint`, `source_row_id`, `import_id` |
| `budget_lines` | `id`, `workspace_id`, `period (YYYY-MM)`, `category_id`, `currency`, `amount_minor`, `source_row_id`, `import_id`, `superseded_by` |
| `documents` | `id`, `file_id`, `supplier`, `doc_date`, `currency`, `total_minor`, `fields_confidence jsonb`, `status (extracted \| reviewed)` |
| `evidence_links` | `document_id`, `transaction_id`, `status (suggested \| confirmed \| rejected)`, `score`, `reasons jsonb`, `confirmed_at` |
| `flags` | `id`, `workspace_id`, `rule`, `severity`, `entity_type`, `entity_id`, `file_id`, `row_number`, `column`, `reason`, `status (open \| resolved \| dismissed)` |
| `change_events` | `id`, `import_id`, `deltas jsonb` (per period/category/currency: before → after) |

### 4.3 Flag rule catalog (MVP)

| Rule | Detects | Counted in figures? |
|---|---|---|
| `parse_error` | Unparseable date or amount, or missing required field | No (row not accepted) |
| `unmapped_category` | Category not resolved | Yes, under "Uncategorized" |
| `currency_mismatch` | Row currency ≠ workspace base currency | Yes, but shown in its own currency (never summed) |
| `possible_duplicate` | Same date+amount+description in a *different* file | Yes, flagged |
| `missing_evidence` | Expense above threshold with no confirmed document | Yes |
| `uncertain_match` | Document whose best match score is below the threshold | n/a |
| `budget_missing` | Actuals in a category with no budget for the period | Yes |

### 4.4 MCP contract (read-only)

One endpoint per workspace: `https://<host>/api/mcp/<workspace_mcp_token>` (Streamable HTTP). The token in the path keeps setup identical across the three clients; see the assumption in SCOPE §6.

| Tool | Returns |
|---|---|
| `get_overview(period?)` | Per-category budget/actual/variance, cash in/out, open flag count, `as_of` |
| `get_budget_variance(category, period?, currency?)` | Budget, actual, variance, contributing transactions (latest first), source refs, `as_of` |
| `search_transactions(query?, category?, period?, has_evidence?)` | Transactions with source refs |
| `get_transaction(id)` | Fields, original CSV row, linked documents with deep links |
| `get_document(id)` | Extracted fields, PDF link, linked transaction |
| `list_review_flags(status?)` | Flags with location and reason |
| `what_changed(import_id?)` | Deltas from the latest (or given) import |

Every response carries `workspace`, `period`, `currency`, `as_of`, and `app_url` deep links. Tool descriptions are bilingual (ES/EN) and list category aliases so "entregas" resolves to Deliveries.

---

## 5. Decisions log

### 5.1 Confirmed by Jordi (product owner)
- Owner workspace product: CSV budget/actual intake, PDF evidence, dashboard with evidence drilldown, read-only MCP, self-serve trial (brief table).
- Midday is the primary benchmark (transaction ↔ document recognition); Ramp is secondary (value clarity).
- Grok is the first live-demo client; Claude and ChatGPT must return the same records.
- Walkthrough: Q3,000 budget / Q2,700 → upload Q600 → Q3,300 actual, Q300 over → link Q600 bill → Grok answers in Spanish.
- Team: Jordi, Hugo, Jose, Antonio from the start; Deyane joins around the midpoint. Time budget ~6h.

### 5.2 Adopted from teammates' proposals
| From | Adopted |
|---|---|
| Rou | Separate raw rows from accepted records; file hash; shared error/flag format with location; "AI never produces a figure"; lock contracts first so everyone builds in parallel; "if it can't be traced, it isn't shown" |
| PLAN.md | Never mutate sources; idempotent re-runs (our fingerprint dedupe); no floats; matching is evidence, separate from accounting effect (ADR-005 maps to our suggested→confirmed links); no silent drops; feature-cut order puts AI polish before lineage |
| CA research | USD/GTQ/HNL/NIO/CRC/PAB reference and versioned "budget rate" idea for the consolidation phase; tax tables for the roadmap tax layer |

### 5.3 Conflicts resolved (trade-offs)

| # | Conflict | Decision | Why (owner experience / delivery) |
|---|---|---|---|
| C1 | **Product framing.** Rou and PLAN.md target a 6-company, 3-currency group consolidation (Grupo AG track). Jordi's brief targets a single-business owner workspace with consolidation as the long-term vision | **Owner workspace is the MVP. Consolidation is phase 2** (§6), built on the same contracts | The brief's walkthrough is single-entity. Consolidation adds FX, intercompany and elimination logic that can't be finished, tested *and* demoed alongside PDF + MCP in 6h. The engine principles transfer directly. **⚠ Confirm, see SCOPE §6 A1:** if we are being judged on the Grupo AG track, this decision flips |
| C2 | **"Chat over Excel" rejected** (Rou, PLAN) vs **ask your AI assistant** (brief) | Compatible: MCP returns engine-computed figures with source refs; the assistant only phrases them | Owners get the convenience of chat without unauditable numbers |
| C3 | **Stack.** Python stdlib + SQLite offline (Rou) vs Next.js + FastAPI + Postgres + Docker (PLAN) vs Next + Supabase (research) | **Next.js (TypeScript) full-stack + Postgres + Blob, deployed on Vercel; MCP as a route in the same app** | MCP must be reachable by Grok/Claude/ChatGPT over public HTTPS, so offline-only can't work. One language and one deploy remove the FastAPI↔Next integration cost in a 6h build. PDF extraction and mapping run fine through the AI SDK in TS. **Pending team confirmation (SCOPE §6 A3)** |
| C4 | **Offline-first demo** (Rou F8) vs remote MCP | Online demo with mitigations: phone hotspot, pre-seeded workspace, recorded backup video | The MCP story needs internet. Mitigate the venue-WiFi risk instead of designing around it |
| C5 | **Time:** 4h (PLAN.md) vs ~6h (brief) | **6h**, Jordi's latest estimate | Per instruction |
| C6 | **Inputs:** Excel multi-sheet, config-per-company loaders (PLAN/Rou) vs CSV (brief) | **CSV only** in MVP; mapping proposal stands in for per-company configs | Owner exports are CSV; XLSX adds parser risk without changing the walkthrough |
| C7 | **Publish gates / immutable runs / BLOCKER severity** (PLAN) vs owner weekly check | **No publish gates.** Figures compute live from accepted records; each import is a versioned batch; answers carry `as_of`. Flags inform but don't block | Owners need a current answer, not a close process. `as_of` still gives app↔AI comparability |
| C8 | **Tax/legal research** scope | Roadmap only. Optional stretch: `vat_included_suspect` flag | No tax computation appears in the walkthrough |

---

## 6. Consolidation (phase 2): how it will work

Agreed design so the MVP contracts don't block it later:

1. **Entities.** `workspaces` gain `entities(id, name, country, functional_currency)`; every record gets `entity_id`. A group view is a selection of entities plus a reporting currency.
2. **Conversion.** Versioned `fx_rate_sets` → `fx_rates(from, to, period, type: budget|average|closing, rate)`, where `rate` = units of reporting currency per 1 unit of source. Each converted amount stores `rate_id` and the set version. A group *budget rate* is the agreed common rate (research: USD reporting). Average vs. closing rates split out the FX effect in variances. Missing rate = blocking flag. Live FX is never used silently.
3. **Intercompany identification.** A record is intercompany only when its counterparty resolves (through an alias table) to another entity in the selected group, never by amount alone. Pairs (seller revenue ↔ buyer expense, receivable ↔ payable) are matched per period **after conversion**, within a tolerance. Outcomes: `matched`, `mismatch` (flag with difference), `one_sided` (flag).
4. **Adjustments.** Each eliminated pair becomes an explicit `adjustment` entry with lineage (both source records, rule, rate version). It is never a hidden subtraction. Group figure = Σ converted contributions + Σ adjustments, and the drilldown shows both.
5. **Out even in phase 2:** partial ownership/NCI, unrealized intercompany profit, statutory IFRS claims.

---

## 7. Glossary

- **Actual transaction**: a record of money that moved, imported from an actuals CSV. Counts toward actuals and cash.
- **Budget line**: planned amount per period, category and currency.
- **Evidence**: a document confirmed as supporting a transaction. Adds proof, never amount.
- **Flag**: a questionable record, with reason and location, shown in the review queue.
- **`as_of`**: the latest applied import ID + timestamp. Lets the app and AI clients prove they read the same state.
- **Source ref**: file name + row number (CSV) or document ID (PDF), plus an app deep link.
