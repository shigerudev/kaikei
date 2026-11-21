"""FastAPI dependencies: DB session and original-file store."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy.orm import Session

from kaikei.infrastructure.db.session import get_sessionmaker
from kaikei.infrastructure.storage import ObjectStore, get_object_store
from kaikei.settings import get_settings


def get_session() -> Iterator[Session]:
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()


@lru_cache
def get_store() -> ObjectStore:
    return get_object_store(get_settings())
