"""ASGI entry point: `uv run fastapi dev kaikei/main.py`."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from kaikei import __version__
from kaikei.api.deps import get_store
from kaikei.api.routes import files, health, runs
from kaikei.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.storage_backend == "s3":
            get_store().ensure_bucket()
        yield

    app = FastAPI(title="Kaikei engine", version=__version__, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(files.router)
    app.include_router(runs.router)
    return app


app = create_app()
