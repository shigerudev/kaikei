"""Real SeaweedFS round trip. Runs only when S3_ENDPOINT_URL is set."""

import hashlib
import os
import uuid

import pytest

from kaikei.infrastructure.storage import S3ObjectStore, StorageConflictError

pytestmark = pytest.mark.skipif(
    not os.environ.get("S3_ENDPOINT_URL"), reason="S3_ENDPOINT_URL not set"
)


def test_put_get_against_seaweedfs() -> None:
    store = S3ObjectStore(
        bucket=os.environ.get("S3_BUCKET", "kaikei-originals"),
        endpoint_url=os.environ["S3_ENDPOINT_URL"],
        access_key=os.environ.get("S3_ACCESS_KEY", "kaikei"),
        secret_key=os.environ.get("S3_SECRET_KEY", "kaikei-local-secret"),
    )
    store.ensure_bucket()
    data = b"integration," + uuid.uuid4().bytes
    sha = hashlib.sha256(data).hexdigest()
    uri = store.put("it-group", sha, "x.csv", data)
    assert store.exists(uri)
    assert store.get(uri) == data
    assert store.put("it-group", sha, "x.csv", data) == uri
    assert not store.exists(uri + "0")
    # a tampered object at the key is detected, never overwritten
    store._client.put_object(Bucket=store._bucket, Key=store._key(uri), Body=b"tampered")
    with pytest.raises(StorageConflictError):
        store.put("it-group", sha, "x.csv", data)
