"""ObjectStore contract shared by the S3 and local backends."""

import hashlib
import re
from typing import Protocol, runtime_checkable

_SAFE = re.compile(r"^[A-Za-z0-9._-]+$")
_SHA = re.compile(r"[0-9a-f]{64}")


class StorageIntegrityError(ValueError):
    """The bytes do not hash to the declared SHA-256."""


class StorageConflictError(RuntimeError):
    """An object already exists at the key with different content (append-only)."""


@runtime_checkable
class ObjectStore(Protocol):
    def ensure_bucket(self) -> None: ...

    def put(self, group_id: str, sha256: str, filename: str, data: bytes) -> str:
        """Store `data` byte-for-byte; return its stored_uri. Repeat puts are no-ops.

        The key is content-addressed (group + sha256); `filename` is not part of it.
        """
        ...

    def get(self, uri: str) -> bytes: ...

    def exists(self, uri: str) -> bool: ...


def object_key(group_id: str, sha256: str) -> str:
    if group_id in {".", ".."} or not _SAFE.fullmatch(group_id):
        raise ValueError(f"invalid group_id: {group_id!r}")
    if not _SHA.fullmatch(sha256):
        raise ValueError("sha256 must be 64 lowercase hex characters")
    return f"originals/{group_id}/{sha256}"


def verify_sha256(sha256: str, data: bytes) -> None:
    actual = hashlib.sha256(data).hexdigest()
    if actual != sha256:
        raise StorageIntegrityError(f"sha256 mismatch: declared {sha256}, actual {actual}")
