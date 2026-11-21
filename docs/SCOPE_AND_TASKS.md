# Kaikei — Scope & Tasks

> **What this is:** how we get from the re-plan to the finished consolidation MVP. It covers owners, parallel work, contracts, checkpoints, the demo and the acceptance checks.
> **Read first:** [`MANIFESTO.md`](./MANIFESTO.md) (decisions and contracts) and [`PLAN.md`](./PLAN.md) (detailed financial rules). If this document conflicts with the manifesto, the manifesto wins.
> **Date:** 2026-11-21 · **Clock:** `R+h:mm` counts from the re-plan kickoff. The schedule follows PLAN.md §15.1 (4h); the team sets wall-clock times at kickoff.

Legend: **J** Jordi (product, UI, fixtures) · **H** Hugo (FX, intercompany, eliminations, optional AI) · **Jo** Jose (DB, ingestion, normalization, validation, acceptance) · **A** Antonio (engine scaffold, API, runs, deploy)

---

## 1. Scope

### 1.1 In (MVP = "done")
1. Group configuration loaded from `entidades.csv`, `tasas_grupo.csv` and `parametros_grupo.csv`: six entities, aliases, rate set, USD reporting currency.
2. Upload of the six packs (CSV; XLSX adapter if the organizers send Excel). Originals kept with SHA-256, every value with its source cell, repeats recognized.
3. Normalization of all six formats into canonical records through reviewer-confirmed mappings.
4. Validation catalog (MANIFESTO §4.3): **13/13** planted errors found, nothing else.
5. FX translation from the pinned group rate set (average for P&L, closing for balance, 2026 average for actuals).
6. Intercompany matching through aliases, with balanced elimination journals for matched pairs. Mismatched and one-sided pairs are flagged and not eliminated.
7. Consolidated facts per immutable run, with publication gates.
8. Inspector: any consolidated number → contributions, rate, match, journal, findings, source cell.
9. Identical reruns, with no duplicate records or journals.

### 1.2 Out
NCI / partial ownership, unrealized profit, dividends, MCP and AI clients, PDF evidence, user accounts, background workers, exports (P1 at best), certified IFRS claims. See MANIFESTO §2 "What waits".

### 1.3 Stack (confirmed, MANIFESTO §5.1 D2)
- **Engine:** Python 3.12, FastAPI + Pydantic v2, SQLAlchemy 2 + Alembic, `decimal.Decimal`, openpyxl for XLSX, the stdlib `csv` module (pandas only where a wide → long reshape needs it), pytest + ruff, managed with `uv`.
- **DB:** PostgreSQL. Money in `NUMERIC(20,4)`, rates in `NUMERIC(20,10)`.
- **UI:** the existing Next.js + TypeScript app at the repo root. It calls the engine API only. TS types are generated from the engine's OpenAPI schema; the UI does no financial math.
- **Local runtime:** Docker Compose with `postgres` + `engine`; Next.js runs with `npm run dev`.
- **Hosting (A3, decided):** `app.kaikei.io` runs on one VPS with Docker Compose: `postgres`, `engine`, `ui` and `caddy`. Only Caddy publishes 80/443 (automatic TLS); `/api/v1` goes to the engine, everything else to the UI. `www.kaikei.io` stays on Vercel in a separate repo.

### 1.4 Repo layout
```
app/ components/            Next.js UI (screens per MANIFESTO §3.2)
lib/api/                    generated TS client + types from engine OpenAPI   ← UI's only data source
engine/
  pyproject.toml
  kaikei/
    api/routes/             FastAPI routers (MANIFESTO §4.4)
    application/            run orchestration, fingerprint, publish
    domain/
      ingestion/            adapters per format, source rows + cells
      normalization/        structural + account mappings → canonical records
      validation/           rule catalog VAL-xxx, findings
      fx/                   rate sets, translation
      intercompany/         alias resolution, matching
      consolidation/        journals, aggregation, facts
      lineage/              fact → source trace
    infrastructure/db/      SQLAlchemy models, Alembic migrations
  tests/                    unit/, integration/, acceptance/ (AC1–AC12)
fixtures/grupo-ag/          six packs, group config, answer keys (+ golden.json, §2.1)
docker-compose.yml
```

---

## 2. Contracts to lock at R+0:20 (everyone builds against these)

Pydantic models in `engine/kaikei/domain/**/models.py` are the source of truth. The UI uses the generated TS types.

| Contract | Owner | Content |
|---|---|---|
| **K1 DB schema** | Jo | MANIFESTO §4.2 tables, first Alembic migration merged, unique constraints in place |
| **K2 Source + canonical record** | Jo | `SourceRef {file_id, filename, sheet, row, column, cell}` and `CanonicalRecord` (MANIFESTO §4.2 fields). Amounts are `Decimal`, serialized as strings |
| **K3 Mapping config** | Jo | Per-company structural mapping (header row, columns, month columns, locale, sign rule, preamble lines) and account mapping (local code → group account, sign multiplier, version). JSON shape per PLAN.md §6.2–6.3 |
| **K4 Finding** | Jo | `Finding {rule_id, rule_version, severity, status, source_refs[], affected_record_ids[], expected?, observed?, difference?, currency?, reason}` per PLAN.md §9.2 |
| **K5 FX + IC + journal** | H | `FxRate`, `TranslatedRecord`, `MatchGroup {mode, status, members[], difference, tolerance}`, `Journal {lines[], source_record_ids[], rule_id}` with `Σ debit = Σ credit` |
| **K6 API** | A | OpenAPI for MANIFESTO §4.4, generated TS client in `lib/api/` |
| **K7 Fixtures + golden numbers** | J | `fixtures/grupo-ag/` (on main) + `golden.json` (§2.1) |
| **K8 Run** | A | `Run {id, status, fingerprint, inputs: file sha256s, mapping_version, rate_set_id, rule_set_version}`. Fingerprint = SHA-256 of those inputs in a fixed order |

### 2.1 Fixtures and golden numbers
- **Already on main:** `fixtures/grupo-ag/`, with six packs, `entidades.csv`, `tasas_grupo.csv`, `parametros_grupo.csv`, `answer_key_mapping.csv` and `answer_key_errors.csv` (13 errors with file and line). `npm run fixtures:check` asserts the pack's integrity.
- **To add (J, by R+1:05):** `fixtures/grupo-ag/golden.json`, **hand-computed and never copied from engine output**. It holds: consolidated revenue, cost of sales and operating profit for **Jan 2027** and **full-year 2027** in USD; the elimination total per IC flow (fixture README table); and the consolidated balance-sheet totals at 2027-12-31 excluding EMP5 (blocked by E10).

---

## 3. Build sequence

### Phase 0: Kickoff, contracts, scaffold (R+0:00 → 0:20), all
| Who | Task | Output |
|---|---|---|
| All | Read MANIFESTO + PLAN §2, §8, §9; inspect the six packs; agree K1–K8 | Contracts merged |
| A | `engine/` scaffold (uv, FastAPI health route, settings, pytest, ruff), `docker-compose.yml` with Postgres, CI command; tag `pre-python` on main and remove the retired TS backend (§8) | `GET /health` green locally |
| Jo | SQLAlchemy models + first Alembic migration (K1); K2–K4 Pydantic models | Migration applies on compose Postgres |
| H | K5 models; rate-set loader from `tasas_grupo.csv` | Types merged |
| J | Screen sketches for MANIFESTO §3.2; start `golden.json` | Sketches + draft golden |

### Phase 1: Six files → canonical records (R+0:20 → 1:05)
**Goal:** all six packs load to canonical records with source cells and confirmed mappings.

| Who | Task | Depends on |
|---|---|---|
| Jo | Ingestion: SHA-256, repeat detection, safe-file checks (type, size, no formula/macro execution); a CSV adapter per format family (long, wide + stacked blocks + subtotals, quoted parentheses, decimal comma + preamble, Debit/Credit); XLSX adapter via openpyxl; locale-aware `Decimal` parsing; source cell on every value | K1, K2 |
| Jo | Normalization: mapping configs for EMP1–EMP6 from `answer_key_mapping.csv`; wide → long; sign by normal balance; unmapped accounts kept as findings | K3 |
| H | Alias resolution (`entidades.csv`), entity-currency lookup, FX translation by statement + scenario with `Decimal` | K5, canonical records |
| A | API: `POST /files`, `GET /files/{id}/preview`, `POST /mappings` + approve; run creation + fingerprint (K8) | K6 |
| J | Upload wizard + parsed-rows preview against fixture JSON, then the live API | K6 |

**✅ Checkpoint C1 (R+1:05).** On the compose stack: the six packs upload → every mapping is approved → canonical record count per entity matches the packs, and each record opens its source cell. *If C1 slips past R+1:30, cut the XLSX adapter (CSV only) and the mapping-approval UI (load configs from files).*

### Phase 2: Validation, IC, consolidation (R+1:05 → 2:05)
| Who | Task | Depends on |
|---|---|---|
| Jo | Validation rules VAL-002/003/006/010/016/019–024 with located findings; acceptance runner `engine/tests/acceptance/` (AC1–AC12) | C1 |
| H | IC matching (aliases, per period after conversion, USD 1.00 tolerance, unique allocation), VAL-004 (missing rate), VAL-007/008, balanced journals per matched pair, VAL-013 | Translation, aliases |
| A | Run orchestration (stages in order, statuses), aggregation into `consolidated_facts`, publication gate, `GET /consolidations/{id}` · `/facts` · `/findings` · `/reconciliations`, `POST /publish` | K8 |
| J | Findings center + consolidated dashboard, built on the API | Phase 1 API |

**✅ Checkpoint C2 (R+2:05).** Run on the fixture pack → **13/13** findings at the answer-key locations, 0 others; every IC flow eliminated except E02/E08; every journal balanced; facts equal `golden.json`. Freeze contracts after C2.

### Phase 3: Inspector + review (R+2:05 → 3:05)
| Who | Task |
|---|---|
| A | `GET /facts/{id}/lineage` (contributions, rates, matches, journals, findings, source cells); `POST /findings/{id}/decisions` creates a new run |
| J | Inspector screen; run screen; publication badge; approve-exception action |
| Jo | Reproducibility test (same inputs → same fingerprint and facts); edge cases from PLAN.md §6.4 (blank ≠ zero, unknown columns kept) |
| H | P1 if C2 is green: KPIs (ROIC/ROCE/EVA from `parametros_grupo.csv` + balance sheet) with missing-input status; otherwise help Jo with findings |

### Phase 4: Integration (R+3:05 → 3:35), all
Run the demo (§5.1) on the deploy target and run the acceptance suite. Apply the cut list. Fixes only from here.

### Phase 5: Freeze & rehearse (R+3:35 → 4:00)
| Task | Who |
|---|---|
| Code freeze; acceptance green; reset the demo database | All |
| Two rehearsals of §5.1; record a backup video | J drives, A on the engine |
| Swap in the organizers' data if it has arrived (re-check assumptions A1–A2) | Jo + H |

### Dependency graph (critical path in bold)
```
K1/K2/K3 ─▶ **ingestion ─▶ normalization ─▶ C1** ─▶ **validation ─▶ C2** ─▶ lineage ─▶ inspector ─▶ freeze
K5 ─▶ aliases + FX ─▶ IC match ─▶ journals ────────────┘          ▲
K6/K8 ─▶ API + runs ─▶ aggregation + publish gate ────────────────┤
J: fixtures JSON ─▶ upload ─▶ findings + dashboard ───────────────┘
```

---

## 4. Cut list (apply in this order if behind)
1. AI narration and AI mapping suggestions.
2. KPIs and variance (show "not computed in this build").
3. Approve-exception UI (decisions via the API only).
4. XLSX adapter (only if the organizers' data is CSV).
5. Multi-scenario history (keep 2027 budget only; 2026 actuals unused).

**Never cut:** source-cell lineage · the 13/13 validator · `Decimal` arithmetic · IC matching with mismatch flags · balanced, separate elimination journals · publication gate on BLOCKERs · identical reruns.

---

## 5. Demo & acceptance

### 5.1 Demo script (~4 min, fixture pack)
1. **Input.** Upload the six packs. The preview shows the six formats normalized (e.g. EMP6 Debit/Credit → signed, EMP5 `1.234,56` → `1234.56`).
2. **Control.** Run → findings center: 13 findings. Open **E02**: EMP1 `Compras a AG Manufactura` mar-2027 = 472,500 GTQ (`01_AG_Distribucion_GT.csv` line 26) vs EMP2 427,500 GTQ (`02_AG_Manufactura_GT.csv` line 4, column Mar). Not eliminated.
3. **Reconciliation.** Dashboard, before/after eliminations: the EMP6 management fees (USD 15,000/month to EMP1, EMP3, EMP4, EMP5) are not group revenue. Open the match and its balanced journal.
4. **Inspection.** Click consolidated revenue Jan 2027 → per-company contributions in USD → GTQ rate 7.75 (2027 average) → journals → the source cell of one contribution.
5. **Gate.** E10 (EMP5 balance sheet off by €50,000) blocks the consolidated balance. Approve or fix → a new run, with the previous run kept.
6. **Confidence.** Rerun the same inputs → same fingerprint, identical totals.

### 5.2 Acceptance checks (`engine/tests/acceptance/`, owner Jo)

| # | Check | Pass condition |
|---|---|---|
| AC1 | **Ingest** | All six packs load. Each canonical record has a source cell that opens the raw value. Stored originals match their SHA-256. Re-uploading a pack → "already imported", 0 new records |
| AC2 | **Mapping** | Every local account maps as in `answer_key_mapping.csv`. Account `9.9.99` (E07) becomes a finding, not a dropped row |
| AC3 | **Validation** | Exactly the 13 findings of `answer_key_errors.csv`, each at its file and line, and no others |
| AC4 | **FX** | Each translated record uses the group rate for its statement and scenario. The local rates in E11a–c are ignored and reported. Removing a rate from the set → BLOCKER, no fact published for that scope |
| AC5 | **Intercompany** | Every flow in the fixture README is matched and eliminated, except E02 (mismatch) and E08 (one-sided), which are flagged and not eliminated |
| AC6 | **Journals** | Every journal balances (`Σ debit = Σ credit`). One journal per matched pair per run. A rerun adds none |
| AC7 | **Consolidated figures** | Facts equal `golden.json`. Each fact = Σ contributions + Σ adjustments |
| AC8 | **Inspector** | For consolidated revenue Jan 2027, the contributions and adjustments shown sum to the figure, and each contribution opens its source cell |
| AC9 | **Publication gate** | With E10 open, the consolidated balance can't publish. After a recorded decision, a new run publishes and the old run is unchanged |
| AC10 | **Reproducibility** | Same inputs and versions → same fingerprint and byte-identical facts |
| AC11 | **AI off** | AC1–AC10 pass with no model configured |
| AC12 | **Untrusted input** | A wrong file type, an oversized file, or an XLSX with formulas is rejected or flagged. Nothing is executed |
| AC13 (P1) | **KPIs** | ROIC/ROCE/EVA show formula and inputs; a removed input → `INSUFFICIENT_DATA` |
| AC14 (P1) | **Variance** | 2027 budget vs 2026 actual components sum exactly to the total |

---

## 6. Assumptions the team must verify

| # | Assumption | Why it matters | Verify by | Owner |
|---|---|---|---|---|
| **A1** | The organizers' data has the same shape as the fixture pack (six companies, three currencies, IC partner hints) | Mappings and rules are tuned to it | Inspect as soon as it arrives | Jo + H |
| **A2** | The data is summary budget lines per account and month, not transactions | Matching is aggregate per company pair + period (PLAN.md §8.2) | Same | H |
| A3 | Hosting: `app.kaikei.io` on one VPS via Docker Compose (Caddy for TLS, Postgres internal only); `www.kaikei.io` on Vercel, separate repo | The demo needs a reachable URL, or else a local compose fallback | Decided; deploy on `chore/vps-deploy` | A |
| A4 | Package installs (`uv sync`, `npm install`) work on the venue network. Unrelated to app authentication: some networks inspect TLS (e.g. Fortinet, see AGENTS.md) and break installs until their CA is trusted | Nobody can build if installs fail | Run `uv sync` and `npm install` at kickoff | A |
| A5 | Golden numbers can be hand-computed for the listed figures by R+1:05 | AC7 depends on them | J reports at C1 | J |
| A6 | Management budget consolidation is what the judges expect (no statutory IFRS) | Scope of claims in the pitch | Ask organizers (PLAN.md §18.1) | J |

---

## 7. After the MVP
PLAN.md §15.2. Phase A stabilize (real-data golden tests); Phase B finance controls (approval workflow, more elimination types, budget-rate management, exports); Phase C scale (workers, object storage, RBAC, multi-tenancy); Phase D expanded consolidation (ownership accounting, unrealized profit, hierarchies, ERP connectors, read-only MCP over published runs).

---

## 8. Migration from the TypeScript backend

The owner-workspace backend in `lib/` is retired. Main is tagged `pre-python` first, so nothing is lost.

| Retire (A, Phase 0) | Port the idea, rewrite in Python |
|---|---|
| `lib/db`, `lib/ingest`, `lib/metrics`, `lib/flags`, `lib/mcp`, `lib/documents`, `lib/mapping`, `lib/ai`, `app/api/**`, `scripts/seed-sample.ts`, `scripts/acceptance.ts`, `scripts/mcp-parity.ts`, Drizzle config | Amount parsing rules from `feat/piper-9-csv-ingest` (`1.234,56`, `(600)`, `600-`, symbols, ISO codes, per-currency decimals) → ingestion locale parsing · fingerprint idea → VAL-006 duplicates · ES/EN header synonyms (`lib/mapping/synonyms.ts`) → structural mapping hints · `suggest()` guardrails → P1 AI narration |

**Kaku:** the PIPER tickets for the owner workspace are superseded. New tickets are created from §3 after this document merges.
