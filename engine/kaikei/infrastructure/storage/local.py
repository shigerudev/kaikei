"""Filesystem backend (default for tests and no-config runs)."""

import os
from pathlib import Path

from kaikei.infrastructure.storage.base import (
    StorageConflictError,
    object_key,
    verify_sha256,
)

_SCHEME = "file://"


class LocalObjectStore:
    def __init__(self, root: str | Path) -> None:
        self._root = Path(root).resolve()

    def ensure_bucket(self) -> None:
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, uri: str) -> Path:
        if not uri.startswith(_SCHEME):
            raise ValueError(f"not a local uri: {uri!r}")
        path = (self._root / uri.removeprefix(_SCHEME)).resolve()
        if not path.is_relative_to(self._root):
            raise ValueError(f"uri escapes the store root: {uri!r}")
        return path

    def put(self, group_id: str, sha256: str, filename: str, data: bytes) -> str:
        verify_sha256(sha256, data)
        uri = f"{_SCHEME}{object_key(group_id, sha256)}"
        path = self._path(uri)
        if path.exists():
            if path.read_bytes() != data:
                raise StorageConflictError(f"different content already stored at {uri}")
            return uri
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
        tmp.write_bytes(data)
        try:
            os.link(tmp, path)  # fails if it already exists: never overwrites
        except FileExistsError:
            if path.read_bytes() != data:
                raise StorageConflictError(f"different content already stored at {uri}") from None
        finally:
            tmp.unlink(missing_ok=True)
        return uri

    def get(self, uri: str) -> bytes:
        return self._path(uri).read_bytes()

    def exists(self, uri: str) -> bool:
        return self._path(uri).is_file()
