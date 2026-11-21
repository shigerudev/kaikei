import pytest

from kaikei.settings import Settings


def test_defaults_keep_ai_off() -> None:
    assert Settings().ai_enabled is False


def test_reads_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:secret@db:5432/k")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.kaikei.io, http://localhost:3000 ,")
    s = Settings()
    assert s.app_env == "production"
    assert s.cors_origin_list == ["https://app.kaikei.io", "http://localhost:3000"]
    assert "secret" not in repr(s)
    assert s.database_url.get_secret_value().endswith("@db:5432/k")


def test_rejects_unknown_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    with pytest.raises(ValueError):
        Settings()
