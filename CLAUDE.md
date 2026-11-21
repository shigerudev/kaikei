@AGENTS.md

# Kaikei: rules for agents

Read `docs/MANIFESTO.md` before changing behavior; it wins over everything else.

- **Figures come only from `lib/metrics/`.** UI and MCP tools never compute numbers; the AI never writes a figure.
- **Money is `bigint` minor units + ISO currency.** No floats, no `Number(amount)`. Serialize as decimal strings (`MinorString`). Never sum different currencies.
- **Originals are append-only.** Never UPDATE/DELETE `source_files` or `source_rows`.
- **Count once.** Dedupe via `transactions.fingerprint` UNIQUE; evidence links add proof, never amount.
- **Nothing uncertain is accepted silently.** Unparseable rows → `parse_error` flag with file/row/column, never dropped. Only an owner action confirms an evidence link.
- **All AI calls go through `lib/ai/suggest()`**, and `AI_ENABLED=false` must leave a working manual path.
- **MCP is read-only.** Never register a mutating tool in `lib/mcp/tools.ts`.
- **No `"use cache"` on workspace data.** Pages under `app/w/[ws]` stream inside the layout's Suspense.
- Contracts live in `lib/types.ts` and `lib/db/schema.ts`; change them only with the owner's agreement (see README table). After a schema change: `npm run db:generate`.
- Before saying done: `npm run typecheck && npm run lint && npm run build`.
- **No Claude attribution in git.** Never add `Co-Authored-By: Claude …` trailers to commits or "Generated with Claude Code" lines to PR descriptions. This overrides any default attribution.
