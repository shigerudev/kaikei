# Kaikei

> Every number opens down to the row. If we can't trace it, we don't show it.

Owner workspace: CSV budget/actual intake → variance dashboard with drilldown to the raw row and the bill PDF → the same figures over a read-only MCP endpoint for Grok / Claude / ChatGPT.

- **What & why:** [`docs/MANIFESTO.md`](docs/MANIFESTO.md) (wins any conflict)
- **Plan, owners, acceptance:** [`docs/SCOPE_AND_TASKS.md`](docs/SCOPE_AND_TASKS.md)

## Quick start

```bash
npm install
cp .env.example .env        # or: vercel env pull .env
cp .env .env.local          # Next reads .env.local; scripts read .env
npm run db:migrate          # applies lib/db/migrations
npm run seed                # sample workspace (once implemented)
npm run dev
```

| Script | Does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | `next typegen && tsc --noEmit` / ESLint |
| `npm run db:generate` | New migration from `lib/db/schema.ts` |
| `npm run db:migrate` / `db:studio` | Apply migrations / browse DB |
| `npm run seed` | `scripts/seed-sample.ts` |
| `npm run acceptance` | `scripts/acceptance.ts` (AC1–AC7) |

## Where things live

| Contract / module | File | Owner |
|---|---|---|
| K1 DB schema | `lib/db/schema.ts` + `lib/db/migrations/` | Jose |
| K2 Mapping, K4 Extraction, K5 Match, K8 AI envelope | `lib/types.ts` | Hugo |
| K3 Metrics API (single source of figures) | `lib/metrics/index.ts` (types in `lib/types.ts`) | Jose |
| K6 MCP tools | `lib/mcp/tools.ts`, route `app/api/mcp/[token]/route.ts` | Antonio + Hugo |
| K7 Fixtures + golden numbers | `fixtures/` | Jordi |
| Ingest (store, parse, fingerprint, apply) | `lib/ingest/` | Jose |
| Column mapping (heuristics + LLM fallback) | `lib/mapping/` | Hugo |
| PDF extract + match | `lib/documents/` | Hugo |
| AI wrapper `suggest()` | `lib/ai/suggest.ts` | Hugo |
| Flag rules + review API | `lib/flags/`, `app/api/w/[ws]/flags/` | Deyane |
| Screens | `app/(marketing)/`, `app/w/[ws]/…` | Jordi |

Open work is marked with `notImplemented("…", "<owner>")` and `TODO(<owner>)`:

```bash
grep -rn "notImplemented(\|TODO(" app lib scripts
```

## Routes

| URL | Screen |
|---|---|
| `/` | 1 Landing / Trial |
| `/w/<ws>?period=YYYY-MM` | 2 Overview |
| `/w/<ws>/import` | 3 Import wizard |
| `/w/<ws>/figure/<period>/<category>/<currency>` | 4 Figure drilldown |
| `/w/<ws>/transactions/<id>` | 5 Transaction (MCP deep-link target) |
| `/w/<ws>/documents/<id>` | 6 Document review |
| `/w/<ws>/review` | 7 Review queue |
| `/w/<ws>/connect` | Connect AI |
| `/api/mcp/<mcp_token>` | MCP (Streamable HTTP, read-only) |

## Stack notes

- **Next.js 16** with Cache Components on. Workspace pages stream inside the `<Suspense>` in `app/w/[ws]/layout.tsx`. **Never add `"use cache"` to figures**, because they must match `as_of`.
- **DB:** Neon Postgres via Drizzle (`drizzle-orm/neon-serverless` Pool, so `applyImport` can use a transaction). Money is `bigint` minor units; it crosses JSON as decimal strings.
- **MCP:** `mcp-handler` 2.x + `@modelcontextprotocol/server` 2.x. Tools take full `z.object(...)` schemas.
- **AI:** AI SDK 7 via AI Gateway, structured output with `generateText({ output: Output.object({ schema }) })`. Only through `lib/ai/suggest()`.
