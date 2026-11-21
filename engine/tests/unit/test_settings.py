import pytest

from kaikei.settings import Settings


def test_reads_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:hunter2@db:5432/k")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.kaikei.io, http://localhost:3000 ,")
    s = Settings()
    assert s.cors_origin_list == ["https://app.kaikei.io", "http://localhost:3000"]
    assert "hunter2" not in repr(s)
    assert s.database_url.get_secret_value().endswith("@db:5432/k")
