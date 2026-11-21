# Contracts K1–K8 (reconstructed)

> **Status:** Reconstructed from Kaku tickets, because the original `SCOPE_AND_TASKS.md` and `MANIFESTO.md` are missing.
> Anything marked **TODO** or **ASSUMPTION** must be confirmed by the owner before it is treated as final.
> The canonical TypeScript/Zod source for K2, K4, K5 and K8 will be `lib/types.ts` (PIPER-6).
> Full shapes are in `docs/HUGO_TRACK_PLAN.md` §1.

| K | Name (best guess) | Owner | Source tickets | Confidence |
|---|---|---|---|---|
| K1 | DB schema + migration | Jose | PIPER-5 | High (ticket explicit) |
| K2 | Column mapping JSON | Hugo | PIPER-6, PIPER-12 | High (ticket explicit) |
| K3 | CSV ingest / source rows / fingerprint | Jose | PIPER-9 | **TODO: the "K3" label is inferred** |
| K4 | PDF extraction JSON | Hugo | PIPER-6, PIPER-21 | High |
| K5 | Match suggestion | Hugo | PIPER-6, PIPER-22 | High |
| K6 | Metrics output (variance / overview) | Jose | PIPER-10 | **TODO: the "K6" label is inferred** |
| K7 | MCP tool contract (7 tools, `as_of`, deep links) | Antonio (descriptions: Hugo) | PIPER-26, PIPER-38 | **TODO: the "K7" label is inferred; tool names unknown** |
| K8 | AI suggestion envelope | Hugo | PIPER-6, PIPER-11 | High |

---

## K1 — DB schema (Jose, PIPER-5)

Known:
- Postgres on Neon. Files go to Vercel Blob.
- **Money is stored as `bigint` minor units** (GTQ 600.00 = `60000`).
- `UNIQUE(workspace_id, sha256)` is the file/document dedupe constraint (upload hash).
- `UNIQUE(workspace_id, fingerprint)` is the actual-row dedupe constraint (re-imported overlapping rows are skipped).
- An `ai_suggestions` table exists. Hugo's required columns are listed in the plan, §4.1.

TODO:
- Exact table names: `workspaces`, `imports`, `source_rows`, `budget_lines`, `actuals`, `documents`, `document_links`/`matches`, `categories`?
- Is `workspace_id` a UUID or text?
- How is `bigint` serialized to app code: string or number? (See open question Q2 in the plan.)
- Where does the "one confirmed link per document" constraint live? Recommended: a partial unique index `UNIQUE(document_id) WHERE status = 'confirmed'`.

## K2 — Column mapping JSON (Hugo, PIPER-6/12)

Known:
- It maps CSV headers to canonical fields.
- An ES/EN synonym table resolves headers first. The LLM is used only for unresolved headers.
- A field resolved by the LLM gets `needsReview = true`.
- An ambiguous column requires the owner's choice.
- It guesses Budget vs Actual for the file.
- It includes category aliases (`entregas` ↔ `Deliveries`).
- The sample headers must map without the LLM.

ASSUMPTION: the canonical field set is `date | description | supplier | category | amount | currency | reference | ignore`.

TODO: confirm the field set against Jordi's fixture headers.

## K3 — CSV ingest (Jose, PIPER-9) — TODO

Known:
- It stores a file hash and `source_rows`.
- It has an apply step.
- It computes a row fingerprint.
- Import summary for `sample_actuals_nov.csv`: **1 new / 2 duplicate / 1 invalid** (the "1/2/1").

TODO:
- Fingerprint formula. Probably `sha256(workspace_id|date|amount_minor|normalized_supplier|normalized_description)`.
- Does ingest consume a K2 `ColumnMapping` object directly? (Hugo assumes **yes**.)

## K4 — PDF extraction JSON (Hugo, PIPER-6/21)

Known:
- Extracted fields: `supplier`, `date`, `currency`, `total`.
- Validation: the date parses, `total > 0`, and the currency is ISO 4217.
- When AI is off, the owner enters the fields manually.
- Fixture `bill_transportes_rapidos.pdf` must extract **Q600.00, GTQ, 2026-11-18**.

## K5 — Match suggestion (Hugo, PIPER-6/22)

Known:
- The scorer is deterministic. Signals: exact amount, date within ±7 days, supplier token overlap.
- **One confirmed link per document.**
- **No auto-confirm.**
- An optional AI tie-break is allowed.
- **Confirming a bill adds evidence. It does not add amount** (AC7).

## K6 — Metrics (Jose, PIPER-10) — TODO

Known:
- Functions: `metrics.getVariance` and `metrics.getOverview`.
- Fixture expectation for Deliveries: budget Q3,000, actual Q2,700 before the Nov import and **Q3,300 after**, giving variance **+Q300**.

TODO:
- Return shapes.
- Variance sign convention. Is +Q300 "actual − budget" (over budget)?
- `as_of` semantics.

## K7 — MCP tools (Antonio PIPER-26; Hugo PIPER-38 descriptions/parity) — TODO

Known:
- There are 7 tools.
- Every tool takes an `as_of` parameter and returns deep links (MANIFESTO §4.4, which is missing).
- Descriptions must be bilingual ES/EN.
- Parity must be verified on Grok, Claude and ChatGPT with a Spanish walkthrough.
- What the server logs must be distinguishable from what the tool returns.

TODO: the 7 tool names and their schemas. Placeholders are in the plan, §4.3.

## K8 — AI suggestion envelope (Hugo, PIPER-6/11)

Known (MANIFESTO §4.5, reconstructed):
- An `AI_ENABLED` flag controls AI. The app must work fully when it is `false`.
- Every model call goes through `suggest()`.
- Output is validated with Zod **and** with reference checks against real data. Invented IDs are rejected (AC14).
- Every attempt writes a row to `ai_suggestions`.
- **Invalid output is stored as rejected and never shown.**
- A timeout returns `null`.
- File content is passed as quoted, untrusted data.
- **The model is given no tools.**

## Acceptance criteria referenced

| AC | Meaning (inferred) | Runner |
|---|---|---|
| AC1–AC6 | Import / dedupe / variance / overview flows (**TODO: exact text**) | Deyane PIPER-31 |
| AC7 | Bill matched to the Q600 actual; confirming adds evidence, not amount | Deyane PIPER-31; Hugo PIPER-22 |
| AC8–AC11 | **TODO: unknown** (probably MCP/UI) | ? |
| AC12 | AI on/off parity | Hugo PIPER-39 + Deyane |
| AC13 | `adversarial_actuals.csv` prompt injection has no effect | Hugo PIPER-39 + Deyane |
| AC14 | Invented ID rejected, with an audit row | Hugo PIPER-39 |
