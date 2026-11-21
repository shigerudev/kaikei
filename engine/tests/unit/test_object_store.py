import hashlib
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

from kaikei.infrastructure.storage import (
    LocalObjectStore,
    ObjectStore,
    S3ObjectStore,
    StorageConflictError,
    StorageIntegrityError,
    get_object_store,
)
from kaikei.settings import Settings

DATA = b"account,amount\n1000,10.50\n"
SHA = hashlib.sha256(DATA).hexdigest()


@pytest.fixture(params=["local", "s3"])
def store(request: pytest.FixtureRequest, tmp_path: Path):
    if request.param == "local":
        s = LocalObjectStore(tmp_path / "store")
        s.ensure_bucket()
        yield s
    else:
        with mock_aws():
            s = S3ObjectStore("kaikei-originals", None, "k", "s", region="us-east-1")
            s.ensure_bucket()
            yield s


def test_protocol(store: ObjectStore) -> None:
    assert isinstance(store, ObjectStore)


def test_roundtrip(store: ObjectStore) -> None:
    uri = store.put("grupo-ag", SHA, "pack.csv", DATA)
    assert uri.endswith(f"originals/grupo-ag/{SHA}")
    assert store.exists(uri)
    assert store.get(uri) == DATA


def test_sha_mismatch_rejected(store: ObjectStore) -> None:
    with pytest.raises(StorageIntegrityError):
        store.put("grupo-ag", SHA, "pack.csv", DATA + b"x")
    assert not store.exists(store.put("other", SHA, "p.csv", DATA).replace("other", "grupo-x"))


def test_repeat_put_is_noop(store: ObjectStore) -> None:
    assert store.put("g", SHA, "a.csv", DATA) == store.put("g", SHA, "b.csv", DATA)


def test_groups_are_separate(store: ObjectStore) -> None:
    assert store.put("g1", SHA, "a.csv", DATA) != store.put("g2", SHA, "a.csv", DATA)


def test_bad_keys_rejected(store: ObjectStore) -> None:
    with pytest.raises(ValueError):
        store.put("../evil", SHA, "a.csv", DATA)
    with pytest.raises(ValueError):
        store.put("g", "ABC", "a.csv", DATA)


def test_local_never_overwrites(tmp_path: Path) -> None:
    s = LocalObjectStore(tmp_path)
    uri = s.put("g", SHA, "a.csv", DATA)
    (tmp_path / "originals" / "g" / SHA).write_bytes(b"tampered")
    with pytest.raises(StorageConflictError):
        s.put("g", SHA, "a.csv", DATA)
    assert s.get(uri) == b"tampered"


def test_s3_never_overwrites() -> None:
    with mock_aws():
        s = S3ObjectStore("bucket-x", None, "k", "s")
        s.ensure_bucket()
        uri = s.put("g", SHA, "a.csv", DATA)
        boto3.client("s3", region_name="us-east-1").put_object(
            Bucket="bucket-x", Key=f"originals/g/{SHA}", Body=b"tampered"
        )
        with pytest.raises(StorageConflictError):
            s.put("g", SHA, "a.csv", DATA)
        assert s.get(uri) == b"tampered"


def test_ensure_bucket_idempotent() -> None:
    with mock_aws():
        s = S3ObjectStore("bucket-x", None, "k", "s")
        s.ensure_bucket()
        s.ensure_bucket()


def test_local_rejects_escaping_uri(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        LocalObjectStore(tmp_path).get("file://../../etc/passwd")


def test_factory(tmp_path: Path) -> None:
    assert isinstance(get_object_store(Settings(storage_local_dir=str(tmp_path))), LocalObjectStore)
    s3 = get_object_store(Settings(storage_backend="s3", s3_endpoint_url="http://x:8333"))
    assert isinstance(s3, S3ObjectStore)
