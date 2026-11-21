"""S3 backend (SeaweedFS in compose; any S3-compatible service)."""

from typing import Any

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from kaikei.infrastructure.storage.base import (
    StorageConflictError,
    object_key,
    verify_sha256,
)

_MISSING = {"404", "NoSuchKey", "NoSuchBucket", "NotFound"}


def _code(err: ClientError) -> str:
    return str(err.response.get("Error", {}).get("Code", ""))


class S3ObjectStore:
    def __init__(
        self,
        bucket: str,
        endpoint_url: str | None,
        access_key: str,
        secret_key: str,
        region: str = "us-east-1",
        client: Any | None = None,
    ) -> None:
        self._bucket = bucket
        self._client = client or boto3.client(
            "s3",
            endpoint_url=endpoint_url or None,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            config=Config(s3={"addressing_style": "path"}, signature_version="s3v4"),
        )

    def ensure_bucket(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError as err:
            if _code(err) not in _MISSING:
                raise
            try:
                self._client.create_bucket(Bucket=self._bucket)
            except ClientError as err2:
                if _code(err2) not in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
                    raise

    def _key(self, uri: str) -> str:
        prefix = f"s3://{self._bucket}/"
        if not uri.startswith(prefix):
            raise ValueError(f"uri not in bucket {self._bucket!r}: {uri!r}")
        return uri.removeprefix(prefix)

    def put(self, group_id: str, sha256: str, filename: str, data: bytes) -> str:
        verify_sha256(sha256, data)
        key = object_key(group_id, sha256)
        uri = f"s3://{self._bucket}/{key}"
        if self.exists(uri):
            if self.get(uri) != data:
                raise StorageConflictError(f"different content already stored at {uri}")
            return uri
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType="application/octet-stream",
            Metadata={"sha256": sha256},
        )
        return uri

    def get(self, uri: str) -> bytes:
        resp = self._client.get_object(Bucket=self._bucket, Key=self._key(uri))
        return resp["Body"].read()

    def exists(self, uri: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=self._key(uri))
        except ClientError as err:
            if _code(err) in _MISSING:
                return False
            raise
        return True
