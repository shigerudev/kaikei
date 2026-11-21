# Kaikei

> From six isolated budgets to one consolidated, explainable result: one reporting currency, no double counting, validated errors, and evidence traced all the way to the original cell.

Multi-company budget consolidation for the Grupo AG track. It takes six company budget packs in three currencies, normalizes them, catches the planted errors, translates them to USD, eliminates intercompany flows with balanced journals, and publishes consolidated figures that drill down to the source file, row and cell. A **read-only MCP** layer lets AI clients query those published figures (no invented numbers).

- **What & why:** [`docs/MANIFESTO.md`](docs/MANIFESTO.md) (wins any conflict)
- **Detailed financial rules:** [`docs/PLAN.md`](docs/PLAN.md)
- **Plan, owners, acceptance:** [`docs/SCOPE_AND_TASKS.md`](docs/SCOPE_AND_TASKS.md)
- **Agent rules:** [`AGENTS.md`](AGENTS.md)

## Layout

| Part | Where | Stack |
|---|---|---|
| Engine + API (all financial logic) | `engine/` | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, `Decimal`, PostgreSQL |
| UI (renders API results only) | `app/`, `components/`, `lib/api/` | Next.js 16, React 19, Tailwind + shadcn/ui, TS client generated from the engine's OpenAPI |
| Build data | `fixtures/grupo-ag/` | Six packs, group config, rate table, answer keys |

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres engine
curl -fsS http://127.0.0.1:8000/health
npm install && npm run dev
```

Postgres publishes no port; it is reachable only from the compose network. The engine is published on `127.0.0.1:8000` with hot reload from `engine/`. Run migrations inside it: `docker compose exec engine uv run alembic upgrade head`. Engine tests run on the host: `cd engine && uv sync && uv run pytest`.

## Checks

| Command | Does |
|---|---|
| `cd engine && uv run pytest` | Engine unit + integration tests |
| `cd engine && uv run pytest tests/acceptance` | AC1–AC12 on the fixture pack (SCOPE §5.2) |
| `cd engine && uv run ruff check . && uv run ruff format --check .` | Lint + format |
| `npm run typecheck && npm run lint && npm run build` | UI |
| `npm run fixtures:check` | Fixture pack integrity: 13/13 planted errors, no unplanted defects |

The TypeScript backend that used to live in `lib/` is retired; its history is under the `pre-python` tag.
