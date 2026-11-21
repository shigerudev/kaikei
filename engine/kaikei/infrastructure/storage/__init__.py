"""Original-file storage: content-addressed, append-only (MANIFESTO §4.1)."""

from kaikei.infrastructure.storage.base import (
    ObjectStore,
    StorageConflictError,
    StorageIntegrityError,
)
from kaikei.infrastructure.storage.factory import get_object_store
from kaikei.infrastructure.storage.local import LocalObjectStore
from kaikei.infrastructure.storage.s3 import S3ObjectStore

__all__ = [
    "LocalObjectStore",
    "ObjectStore",
    "S3ObjectStore",
    "StorageConflictError",
    "StorageIntegrityError",
    "get_object_store",
]
