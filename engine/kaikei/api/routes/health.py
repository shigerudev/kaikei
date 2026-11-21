"""Liveness probe. It does not touch the database."""

from fastapi import APIRouter
from pydantic import BaseModel

from kaikei import __version__

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: str
    version: str


@router.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok", version=__version__)
