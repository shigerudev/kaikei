from kaikei.infrastructure.storage.base import ObjectStore
from kaikei.infrastructure.storage.local import LocalObjectStore
from kaikei.infrastructure.storage.s3 import S3ObjectStore
from kaikei.settings import Settings


def get_object_store(settings: Settings) -> ObjectStore:
    if settings.storage_backend == "s3":
        return S3ObjectStore(
            bucket=settings.s3_bucket,
            endpoint_url=settings.s3_endpoint_url,
            access_key=settings.s3_access_key,
            secret_key=settings.s3_secret_key.get_secret_value(),
            region=settings.s3_region,
        )
    return LocalObjectStore(settings.storage_local_dir)
