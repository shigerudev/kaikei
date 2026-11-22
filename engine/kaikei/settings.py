"""Runtime configuration from the environment (see the repo's .env.example)."""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", frozen=True)

    database_url: SecretStr = SecretStr("postgresql+psycopg://kaikei:kaikei@localhost:5432/kaikei")
    cors_origins: str = "http://localhost:3000"

    # Original-file storage. `local` needs nothing running (tests, no-config runs).
    storage_backend: Literal["s3", "local"] = "local"
    storage_local_dir: str = ".kaikei-originals"
    s3_endpoint_url: str | None = None
    s3_bucket: str = "kaikei-originals"
    s3_region: str = "us-east-1"
    s3_access_key: str = "kaikei"
    s3_secret_key: SecretStr = SecretStr("kaikei-local-secret")
    # When true, group-scoped routes require a valid session (production). Tests stay open.
    auth_required: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
