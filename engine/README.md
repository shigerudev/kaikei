# Kaikei engine (Python)

Financial consolidation engine for Grupo AG. UI stays in Next.js and only consumes this API.

**Owners:** Jose (ingest/normalize/validate) · Hugo (FX/IC/eliminations) · Antonio (API/runs/compose)

## Status

Phase 0 slice (Hugo): K5 Pydantic models + `tasas_grupo.csv` / `entidades.csv` loaders under `kaikei/domain/{fx,intercompany,consolidation}/`.

`TODO(Antonio):` FastAPI `/health`, settings, `docker-compose.yml`, Alembic, OpenAPI → `lib/api/`.

## Setup

```bash
cd engine
uv sync --extra dev
uv run pytest
uv run ruff check .
```
