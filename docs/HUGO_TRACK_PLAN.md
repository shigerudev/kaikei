# Hugo (shigeru.dev): Tech/AI track plan for PipePiper

**Product:** an owner workspace for importing budgets and actuals, computing variance, matching PDF evidence, and exposing MCP tools to AI clients. It is **not** a chat-over-Excel demo. AI only *suggests*. Deterministic code and the owner *decide*.

**Hugo's tickets:**

| Ticket | Priority | Phase | Scope |
|---|---|---|---|
| PIPER-6 | CRITICAL | 0 | Type contracts |
| PIPER-11 | CRITICAL | 1 | `lib/ai` core |
| PIPER-12 | HIGH | 1 | Column mapping |
| PIPER-21 | HIGH | 2 | PDF extraction |
| PIPER-22 | HIGH | 2 | Match scorer |
| PIPER-38 | HIGH | 3 | MCP descriptions + client parity |
| PIPER-39 | HIGH | 3 | AI safety tests |

**Source of truth:** the original SCOPE/MANIFESTO docs are missing, so the contracts here are reconstructed from tickets. Items marked **ASSUMPTION** must be confirmed. See `docs/CONTRACTS_RECONSTRUCTED.md` for K1–K8.

---

## 0. Ground rules (reconstructed MANIFESTO §4.5)

1. `AI_ENABLED !== "true"` means no model call is ever made. Every flow has a manual or deterministic path, and the app must be fully usable this way.
2. The only way to call a model is `suggest()` in `lib/ai/suggest.ts`. A lint rule or grep check forbids importing `ai` / `@ai-sdk/*` anywhere else.
3. The model receives **no tools**. Output is structured-only (`generateObject` with a Zod schema).
4. File or CSV content is wrapped as **quoted untrusted data** inside delimiters. The system prompt says that content is data and must never be followed as instructions.
5. Every output passes **(a)** the Zod schema and **(b)** reference checks against real DB data: each ID or name must exist in the candidate set given to the model. Anything else is rejected.
6. Every attempt writes one `ai_suggestions` row, whatever its outcome: valid, invalid, rejected, timeout or error.
7. Invalid or rejected output is **stored but never returned to the UI or MCP**. `suggest()` returns `null`.
8. A timeout or provider error also makes `suggest()` return `null`, and the UI falls back to manual.
9. AI never confirms anything. LLM-sourced values always carry `needsReview: true`, and there is no auto-confirm anywhere.

---

## 1. Reconstructed contracts (`lib/types.ts`, PIPER-6)

> Money convention (**ASSUMPTION**, pending Jose): in app/JSON contracts, money is a JS `number` holding an **integer in minor units**. GTQ 600.00 is `60000`. This is safe below 2^53. The DB stores it as `bigint`, and Jose's repo layer converts with `Number()`. If Jose prefers strings, switch `MinorUnits` to a `z.string().regex(/^-?\d+$/)`-based schema. Only this one schema needs to change.

```ts
// lib/types.ts
import { z } from "zod";

// ---------- shared primitives ----------
export const Id = z.string().min(1);                       // ASSUMPTION: uuid/text, confirm with Jose
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s + "T00:00:00Z")), "invalid date");
export const IsoCurrency = z.string().regex(/^[A-Z]{3}$/);  // ISO 4217 shape; whitelist in lib/money.ts
export const MinorUnits = z.number().int();                 // bigint minor units in DB
export const PositiveMinorUnits = MinorUnits.positive();
export const Confidence = z.number().min(0).max(1);

// ---------- K2: Column mapping JSON ----------
export const CanonicalField = z.enum([
  "date", "description", "supplier", "category", "amount", "currency", "reference", "ignore",
]); // ASSUMPTION: confirm against Jordi's fixture headers
export const MappingSource = z.enum(["synonym", "llm", "owner"]);
export const FileKind = z.enum(["budget", "actual"]);

export const ColumnMappingEntry = z.object({
  header: z.string(),                       // raw header exactly as in the CSV
  columnIndex: z.number().int().nonnegative(),
  field: CanonicalField.nullable(),         // null = unresolved / ambiguous → owner must choose
  source: MappingSource,
  confidence: Confidence,
  needsReview: z.boolean(),                 // true whenever source==="llm" or field===null
  candidates: z.array(CanonicalField).default([]), // >1 = ambiguous; UI shows these as choices
});

export const CategoryAlias = z.object({
  raw: z.string(),                          // e.g. "entregas"
  categoryId: Id.nullable(),                // resolved workspace category, e.g. Deliveries
  categoryName: z.string().nullable(),
  source: MappingSource,
  needsReview: z.boolean(),
});

export const ColumnMapping = z.object({
  version: z.literal(1),
  fileKind: z.object({ value: FileKind.nullable(), source: MappingSource, needsReview: z.boolean() }),
  columns: z.array(ColumnMappingEntry),
  categoryAliases: z.array(CategoryAlias),
  status: z.enum(["complete", "needs_owner"]), // complete ⇔ every required field resolved & no needsReview left
});
export type ColumnMapping = z.infer<typeof ColumnMapping>;

// Required fields for "complete" (ASSUMPTION):
//   actual: date, amount, category (supplier/description optional)
//   budget: category, amount (date or period optional, TODO with Jose)

// ---------- K4: PDF extraction JSON ----------
export const ExtractionFields = z.object({
  supplier: z.string().trim().min(1),
  date: IsoDate,
  currency: IsoCurrency,
  totalMinor: PositiveMinorUnits,           // total > 0
});
export const DocumentExtraction = z.object({
  version: z.literal(1),
  documentId: Id,
  source: z.enum(["ai", "manual"]),
  fields: ExtractionFields,
  aiSuggestionId: Id.nullable(),            // set when source==="ai"
  needsReview: z.boolean(),                 // true for "ai" until owner saves
});
export type DocumentExtraction = z.infer<typeof DocumentExtraction>;
// Fixture: bill_transportes_rapidos.pdf → { supplier: "Transportes Rápidos" (TODO exact string),
//   date: "2026-11-18", currency: "GTQ", totalMinor: 60000 }

// ---------- K5: Match suggestion ----------
export const MatchReasons = z.object({
  amountExact: z.boolean(),                 // document.totalMinor === actual.amountMinor (same currency)
  dateDeltaDays: z.number().int(),          // |doc.date - actual.date|
  withinDateWindow: z.boolean(),            // dateDeltaDays <= 7
  supplierTokenOverlap: z.number().min(0).max(1), // Jaccard on normalized tokens
});
export const MatchStatus = z.enum(["suggested", "confirmed", "rejected"]);
export const MatchSuggestion = z.object({
  version: z.literal(1),
  documentId: Id,
  actualId: Id,
  score: z.number().min(0).max(1),
  reasons: MatchReasons,
  rank: z.number().int().positive(),
  tieBreak: z.object({ aiSuggestionId: Id, chosen: z.boolean() }).nullable(), // optional AI tie-break
  status: MatchStatus,                      // scorer only ever emits "suggested"
});
export type MatchSuggestion = z.infer<typeof MatchSuggestion>;
// Invariants: ≤1 confirmed per documentId (DB partial unique). Confirming a link attaches evidence
// to the actual; it NEVER creates or changes an amount (AC7).

// ---------- K8: AI suggestion envelope ----------
export const AiSuggestionKind = z.enum(["column_mapping", "pdf_extraction", "match_tiebreak"]);
export const AiSuggestionStatus = z.enum([
  "valid",      // passed Zod + reference checks → may be shown (always needsReview)
  "invalid",    // failed Zod
  "rejected",   // passed Zod, failed reference checks (e.g. invented ID)
  "timeout",
  "error",      // provider/network error
]);
export const OwnerDecision = z.enum(["pending", "accepted", "edited", "dismissed"]);

export const AiSuggestionEnvelope = z.object({
  id: Id,
  workspaceId: Id,
  kind: AiSuggestionKind,
  subjectType: z.enum(["import", "document"]),
  subjectId: Id,
  model: z.string(),                        // e.g. gateway model id
  promptVersion: z.string(),                // e.g. "mapping@1"
  inputSha256: z.string(),                  // hash of exact prompt payload
  rawOutput: z.unknown().nullable(),        // stored verbatim, never rendered
  parsedOutput: z.unknown().nullable(),     // only when status==="valid"
  status: AiSuggestionStatus,
  validationErrors: z.array(z.string()),    // Zod issues + reference-check failures
  referencedIds: z.array(Id),               // IDs the output claimed; audit for AC14
  latencyMs: z.number().int().nonnegative(),
  ownerDecision: OwnerDecision,
  createdAt: z.string(),                    // ISO timestamp
});
export type AiSuggestionEnvelope = z.infer<typeof AiSuggestionEnvelope>;

// What callers receive from suggest(): only ever a valid suggestion, or null.
export type Suggestion<T> = { suggestionId: string; value: T; needsReview: true } | null;
```

---

## 2. Files Hugo creates

```
lib/
  types.ts                      # PIPER-6: K2/K4/K5/K8 Zod + inferred types (single source)
  money.ts                      # PIPER-6: toMinor/fromMinor/formatGTQ, ISO currency whitelist
  ai/
    config.ts                   # PIPER-11: aiEnabled() reads AI_ENABLED; model id; timeoutMs
    untrusted.ts                # PIPER-11: quoteUntrusted(label, content): delimiter + escape + truncation
    suggest.ts                  # PIPER-11: suggest<T>(): the ONLY model entry point
    references.ts               # PIPER-11: reference-check helpers (idIn, nameIn, headerIn)
    store.ts                    # PIPER-11: AiSuggestionStore interface + inMemoryStore (tests)
    store.db.ts                 # PIPER-11: Jose-DB-backed impl (lands after PIPER-5)
    prompts/
      mapping.ts                # PIPER-12: system prompt + promptVersion
      extraction.ts             # PIPER-21
      tiebreak.ts               # PIPER-22 (optional)
  mapping/
    synonyms.ts                 # PIPER-12: ES/EN header synonyms + category aliases
    normalize.ts                # PIPER-12: lowercase, strip accents/punct, collapse spaces
    resolve.ts                  # PIPER-12: resolveMapping(headers, sampleRows, categories) → ColumnMapping
    fileKind.ts                 # PIPER-12: guess budget vs actual
  extraction/
    pdfText.ts                  # PIPER-21: PDF → text (lib TBD, e.g. unpdf)
    extract.ts                  # PIPER-21: extractDocument() via suggest(); manual path
  match/
    tokens.ts                   # PIPER-22: supplier normalization + Jaccard
    score.ts                    # PIPER-22: scoreCandidates(doc, actuals) → MatchSuggestion[]
    tiebreak.ts                 # PIPER-22: optional AI tie-break via suggest()
  mcp/
    descriptions.ts             # PIPER-38: bilingual ES/EN descriptions keyed by tool name
tests/
  types.test.ts                 # PIPER-6
  ai/suggest.test.ts            # PIPER-11: disabled/timeout/invalid/rejected/valid paths
  ai/untrusted.test.ts          # PIPER-11
  mapping/resolve.test.ts       # PIPER-12: sample headers map w/o LLM; ambiguous → needs_owner
  extraction/extract.test.ts    # PIPER-21: fixture → Q600.00 GTQ 2026-11-18; manual path
  match/score.test.ts           # PIPER-22: AC7 unit level
  safety/ac12_parity.test.ts    # PIPER-39
  safety/ac13_injection.test.ts # PIPER-39
  safety/ac14_invented_id.test.ts # PIPER-39
docs/
  MCP_PARITY.md                 # PIPER-38: per-client pass/fail/not-verified table
```

Hugo does **not** touch these, which belong to others: `app/**` (Antonio/Jordi), `db/**` and migrations (Jose), `lib/ingest/**` and `lib/metrics/**` (Jose), `fixtures/**` (Jordi), the MCP route handler (Antonio), and the acceptance runner (Deyane).

---

## 3. Execution order

**Model legend:**
- **Opus 5.5:** contracts and security-critical design.
- **Sonnet 5.5:** default implementation.
- **Haiku 5.5:** tables, boilerplate, simple tests.

| # | Ticket | Step | Depends on | Model |
|---|---|---|---|---|
| 1 | PIPER-6 | Minimal scaffold (see §5): `package.json` (zod, typescript, vitest), `tsconfig.json`, `vitest.config.ts` | none | Haiku |
| 2 | PIPER-6 | Write `lib/types.ts` exactly as in §1, plus `lib/money.ts` | 1 | **Opus** |
| 3 | PIPER-6 | `tests/types.test.ts`: round-trip valid samples; reject `total<=0`, bad date, `"gtq"`, two confirmed matches | 2 | Haiku |
| 4 | PIPER-6 | Post the contracts to Jose/Jordi/Antonio and resolve Q1–Q2 (§7) → **REVIEW** | 3 | none |
| 5 | PIPER-11 | `config.ts`, `untrusted.ts`, `references.ts`, `store.ts` (interface + in-memory) | 2 | **Opus** (design), Sonnet (code) |
| 6 | PIPER-11 | `suggest.ts`: AI_ENABLED gate → build prompt → `generateObject` (no `tools`) under `AbortSignal.timeout` → Zod → reference checks → store row → return `Suggestion<T>` | 5, Antonio AI Gateway env | **Opus** |
| 7 | PIPER-11 | `tests/ai/suggest.test.ts` with a mocked model: disabled ⇒ 0 calls + null; timeout ⇒ row `timeout` + null; garbage ⇒ row `invalid` + null; fake ID ⇒ row `rejected` + null; good ⇒ row `valid` + value | 6 | Sonnet |
| 8 | PIPER-11 | `store.db.ts` against Jose's `ai_suggestions` table | PIPER-5 | Sonnet |
| 9 | PIPER-12 | `normalize.ts` + `synonyms.ts` (ES/EN table, `entregas`→Deliveries, etc.) | 2 | Haiku |
| 10 | PIPER-12 | `resolve.ts` + `fileKind.ts`: synonyms first; LLM only for unresolved headers via `suggest("column_mapping")` with the reference check "field ∈ CanonicalField, header ∈ actual headers, categoryId ∈ workspace categories" | 6, 9 | Sonnet |
| 11 | PIPER-12 | Tests: Jordi's sample headers → `status:"complete"` with **0 model calls**; an ambiguous header → `field:null`, `needs_owner` | 10, PIPER-7 headers | Sonnet |
| 12 | PIPER-22 | `tokens.ts`, `score.ts`: weights amount 0.5 / date 0.25 / supplier 0.25 (**ASSUMPTION**); candidates require same currency; emits only `suggested` | 2 | Sonnet |
| 13 | PIPER-22 | `tiebreak.ts`: only when the top two scores are within 0.05; reference check "chosen actualId ∈ the tied candidates" | 6, 12 | Sonnet |
| 14 | PIPER-22 | Unit AC7: bill vs Nov actuals → top = the new Q600 row; a confirm helper contract leaves the Deliveries actual at Q3,300 (evidence only) | 12, PIPER-7, PIPER-10 | Sonnet |
| 15 | PIPER-21 | `pdfText.ts` + `extract.ts`: AI path via `suggest("pdf_extraction")` with K4 validation; manual path returns an empty form contract | 6, PIPER-7 PDF | Sonnet |
| 16 | PIPER-21 | Tests: fixture → `{2026-11-18, GTQ, 60000}` (mocked model for CI; one live run logged); AI off ⇒ manual save works | 15 | Sonnet |
| 17 | PIPER-39 | AC12: run the full fixture flow with AI_ENABLED=false and =true (mocked) → identical metrics (Q3,300 / +Q300 / 1·2·1) | 11, 14, 16, PIPER-9/10 | Sonnet |
| 18 | PIPER-39 | AC13: `adversarial_actuals.csv` → no instruction followed, no extra rows/IDs, mapping output still validated, audit row written | 10, PIPER-7 | **Opus** (threat cases), Sonnet (code) |
| 19 | PIPER-39 | AC14: model returns a nonexistent `actualId`/`categoryId` → row `rejected` with `referencedIds` populated, nothing surfaced | 7 | Sonnet |
| 20 | PIPER-38 | `lib/mcp/descriptions.ts`: ES/EN description per tool (names from Antonio) | PIPER-26 names | Sonnet |
| 21 | PIPER-38 | Spanish walkthrough script, run on Grok, Claude and ChatGPT; record *server log* vs *tool output* vs *client answer* per step in `docs/MCP_PARITY.md` | 20, PIPER-26 deployed | Hugo (manual), Haiku to format |

**Critical path:** 1→2→4 (unblocks everyone), then 5→6→7, then 9–11 ∥ 12–14 ∥ 15–16, then 17–19, then 20–21.

**Parallelization:** the PIPER-22 scorer (step 12) has no AI dependency, so it can start right after step 2.

### `suggest()` signature (PIPER-11)

```ts
export async function suggest<T>(args: {
  kind: AiSuggestionKind;
  workspaceId: string;
  subject: { type: "import" | "document"; id: string };
  schema: z.ZodType<T>;
  promptVersion: string;
  system: string;                                   // trusted, static per kind
  untrusted: { label: string; content: string }[];  // quoted via quoteUntrusted()
  context?: Record<string, unknown>;                // trusted candidate lists (IDs/names) the model may reference
  checkReferences: (value: T) => { ok: true; ids: string[] } | { ok: false; errors: string[]; ids: string[] };
  timeoutMs?: number;                               // default 8000 (ASSUMPTION)
  store?: AiSuggestionStore;                        // injected; DB impl in prod
}): Promise<Suggestion<T>>;
```

The model is called with `generateObject({ model, schema, system, prompt })` and **never** with `tools`. If AI is disabled, `suggest()` returns `null` without writing a row (**ASSUMPTION**: the audit only covers attempts; see Q4).

---

## 4. Interface contracts with teammates

### 4.1 Jose (PIPER-5 schema, PIPER-9 ingest, PIPER-10 metrics)

**`ai_suggestions` table (Hugo requests these columns):**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | FK workspaces | |
| `kind` | text check in (`column_mapping`,`pdf_extraction`,`match_tiebreak`) | |
| `subject_type` | text (`import`,`document`) | |
| `subject_id` | uuid/text | |
| `model` | text | |
| `prompt_version` | text | |
| `input_sha256` | text | |
| `raw_output` | jsonb null | never rendered |
| `parsed_output` | jsonb null | only when `status='valid'` |
| `status` | text check in (`valid`,`invalid`,`rejected`,`timeout`,`error`) | |
| `validation_errors` | jsonb (string[]) default `[]` | |
| `referenced_ids` | jsonb (string[]) default `[]` | AC14 audit |
| `latency_ms` | int | |
| `owner_decision` | text default `pending` (`pending`,`accepted`,`edited`,`dismissed`) | |
| `created_at` | timestamptz default now() | |

Index: `(workspace_id, subject_type, subject_id)`.

**Other things Hugo needs from Jose:**
- **Ingest (PIPER-9) consumes a `ColumnMapping` (K2)** with `status:"complete"`. Ingest must refuse a mapping with `needs_owner`.
- **Match persistence:**
  - Matches are stored in a link table with columns `document_id`, `actual_id`, `score`, `reasons jsonb`, and `status`.
  - The table needs a partial unique index `(document_id) WHERE status='confirmed'`.
  - Confirming a link never writes to `actuals.amount`.
- **Repo functions Hugo calls (names TODO):**
  - `listActualCandidates(workspaceId, { currency, from, to })`
  - `listCategories(workspaceId)`
  - `getDocument(id)`
  - `saveExtraction(DocumentExtraction)`
  - `saveMatchSuggestions(MatchSuggestion[])`
- **Metrics (PIPER-10):** AC12 parity compares `getVariance`/`getOverview` output byte-for-byte between AI off and AI on.

### 4.2 Jordi (PIPER-7 fixtures, PIPER-13/14 UI)

**Fixture expectations Hugo's tests assert:**

| Fixture | Expectation |
|---|---|
| Seed | Deliveries budget **Q3,000** (`300000`), actual **Q2,700** (`270000`) |
| `sample_actuals_nov.csv` | 1 new Q600 row + 2 overlapping rows + 1 bad row ⇒ summary **1 new / 2 duplicate / 1 invalid**; Deliveries actual → **Q3,300**, variance **+Q300** |
| `sample_budget_dec.csv` | Headers map fully via synonyms; `fileKind = budget` |
| `bill_transportes_rapidos.pdf` | Extracts **Q600.00 GTQ 2026-11-18**; top match = the new Q600 Nov actual |
| `adversarial_actuals.csv` | Contains injection text in cells/headers; expected result: ingest outcome unchanged by the text, AI output still schema- and reference-validated |

**Needs from Jordi:**
- The exact header row of each CSV, so the synonym table covers it, including `entregas`.
- The exact supplier string on the bill.

**UI contract (PIPER-13/14):**
- Render only `Suggestion<T>` values, which are never null-unsafe.
- Show a "needs review" badge whenever `needsReview` is true.
- When `ColumnMapping.status === "needs_owner"`, show a choice for every column with `field === null`, using its `candidates` as options.
- The match UI has a Confirm button and nothing auto-confirms.

### 4.3 Antonio (PIPER-4 scaffold, PIPER-26 MCP)

**Env vars:**
- `AI_ENABLED` is the string `"true"` or `"false"` and defaults to false. Hugo reads it **only** in `lib/ai/config.ts`.
- AI Gateway key (name TODO, e.g. `AI_GATEWAY_API_KEY`).
- Model id (**ASSUMPTION**: `AI_MODEL`, with a default in `config.ts`).

**Packages Hugo needs in the scaffold:** `zod`, `ai`, `vitest`, a PDF text library (TBD), and the `@/*` path alias pointing at the repo root.

**MCP tools.** These are **placeholder names**; Antonio is the source of truth. Every tool takes `as_of` and returns deep links.

| # | Placeholder | Likely purpose |
|---|---|---|
| 1 | `get_overview` | Workspace totals as of a date |
| 2 | `get_variance` | Budget vs actual per category |
| 3 | `list_actuals` | Filtered actual rows |
| 4 | `list_imports` | Import history + 1/2/1 summaries |
| 5 | `list_documents` | PDF evidence + extraction status |
| 6 | `list_match_suggestions` | Suggested and confirmed links |
| 7 | `get_category` | One category's detail |

**Description handoff:**
- Hugo ships `descriptions.ts` exporting `Record<ToolName, { es: string; en: string }>`.
- Antonio registers each tool's description as `` `${es}\n\n${en}` `` (**ASSUMPTION**: one combined bilingual string).
- MCP tools are **read-only** as far as AI is concerned. They never call `suggest()`.

### 4.4 Deyane (PIPER-31)

Hugo exports helpers the runner can reuse for AC12/AC13: `runFixtureFlow({ aiEnabled, model: mock|live })`. It shares the fixture assertions so the same numbers are not duplicated in two places.

---

## 5. What to scaffold now vs wait for Antonio

**Scaffold now** (Hugo, in commit #1, ~10 files, no Next.js):
```
package.json        # name, "type":"module", scripts: { test: "vitest run", typecheck: "tsc --noEmit" }
                    # deps: zod   devDeps: typescript, vitest, @types/node
tsconfig.json       # strict, moduleResolution "bundler", paths { "@/*": ["./*"] }
vitest.config.ts    # alias @ → root
lib/types.ts, lib/money.ts, tests/types.test.ts
docs/*.md
```

**Wait for Antonio:**
- `create-next-app`, `app/`, Tailwind/shadcn, `next.config`, Vercel project, Neon/Blob wiring, `.env.example`, and the MCP route.

**Coordination risk:** `create-next-app` refuses to run in a directory that already has `package.json`/`tsconfig.json`.
- **Ask Antonio** to scaffold into a temp dir and copy it in, merging Hugo's deps and scripts.
- **Or** Hugo lands on branch `hugo/contracts` and rebases onto Antonio's scaffold, then reconciles `package.json` (keep Next's file and add `zod`/`vitest` + the `test`/`typecheck` scripts).
- Pick one in the first sync (Q3).

**Do not add:** ESLint config, Prettier, or a DB client. Those belong to Antonio and Jose.

---

## 6. Steering protocol (Kaku)

**Status flow per ticket:** `BACKLOG → READY → IN_PROGRESS → REVIEW → DONE` (DONE comes after reviewer approval).

| Moment | Kaku call |
|---|---|
| Pick up ticket | `move_work_item {key, target_status:"READY"}` if deps met, then `"IN_PROGRESS"` |
| Start | `report_agent_log {key, phase:"ANALYZING", message:"reading deps: PIPER-5 table shape…"}` |
| Coding | `report_agent_log {phase:"EXECUTING", message:"suggest(): zod+ref checks done, store pending"}` (one line per meaningful milestone, not per file) |
| Testing | `report_agent_log {phase:"VERIFYING", message:"vitest: 14/14; AC14 rejected row asserted"}` |
| Green | `report_agent_log {phase:"VERIFIED", message:"<what was proved>"}` |
| Red | `report_agent_log {phase:"FAILED", message:"<failing test + cause>"}` |
| Evidence | `attach_evidence {key, type:"COMMIT", url:"<sha>"}`; add `TEST_RESULT` (vitest summary) when relevant |
| Hand-off | `move_work_item {key, target_status:"REVIEW", evidence_type:"COMMIT", evidence_ref:"<sha>"}` (REVIEW requires evidence) |
| Blocked | `move_work_item {key, target_status:"BLOCKED", reason:"waiting PIPER-5 ai_suggestions columns"}` + `add_comment` tagging the owner |

**Commit convention:** `PIPER-<n>: <imperative summary>`. One ticket per commit where possible, so the SHA maps cleanly to evidence.

**Blocking rule:** if a dependency is missing, code against the interface (in-memory store, fixture stubs), mark the ticket `BLOCKED` only if the AC truly can't be proven, and say exactly what is missing.

---

## 7. Open questions for teammates (prioritized)

1. **Jose: `ai_suggestions` and the match-link table.** Do you accept the columns in §4.1 and the partial unique index `(document_id) WHERE status='confirmed'`? This blocks PIPER-11 persistence and PIPER-22 confirm semantics.
2. **Jose: money serialization.** Should `bigint` minor units cross into app code as `number` or as a `string`? Does ingest (PIPER-9) take a K2 `ColumnMapping` object as input? This affects the K2/K4/K5 shapes.
3. **Antonio: scaffold sequencing and env names.** Will you scaffold into a temp dir and merge my `package.json`, or should I rebase onto yours? What are the exact names of the AI Gateway key and model env vars, and which PDF text library is approved?
4. **Antonio: the 7 MCP tool names and input schemas**, and whether descriptions are one combined ES+EN string. Also, should a call with `AI_ENABLED=false` write an audit row (I assume no)?
5. **Jordi: exact fixture headers** for all three CSVs, the bill's exact supplier string, and the injection payloads in `adversarial_actuals.csv`. These are needed for the PIPER-12 synonym coverage and the AC13 assertions.
