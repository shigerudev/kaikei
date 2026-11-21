# Kaikei engine (Python)

Financial consolidation engine for Grupo AG. UI stays in Next.js and only consumes this API.

**Owners:** Jose (ingest/normalize/validate) · Hugo (FX/IC/eliminations) · Antonio (API/runs/compose)

## Status

Phase 0 slice (Hugo): K5 Pydantic models + `tasas_grupo.csv` / `entidades.csv` loaders under `kaikei/domain/{fx,intercompany,consolidation}/`.

Phase 0 slice (Antonio): FastAPI app (`kaikei/main.py`, `GET /health`), settings (`kaikei/settings.py`), root `docker-compose.yml`.

`TODO(Antonio):` OpenAPI → `lib/api/`. Alembic setup lands with K1 (Jose).

## Setup

```bash
cd engine
uv sync --extra dev
uv run ruff check . && uv run ruff format --check . && uv run pytest
```
