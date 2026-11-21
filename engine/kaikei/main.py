"""ASGI entry point: `uv run fastapi dev kaikei/main.py`."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from kaikei import __version__
from kaikei.api.routes import (
    consolidations,
    facts,
    files,
    findings,
    groups,
    health,
    mappings,
)
from kaikei.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Kaikei engine", version=__version__)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(groups.router)
    app.include_router(files.router)
    app.include_router(mappings.router)
    app.include_router(consolidations.router)
    app.include_router(findings.router)
    app.include_router(facts.router)
    return app


app = create_app()
