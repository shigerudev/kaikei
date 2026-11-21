from fastapi.testclient import TestClient

from kaikei import __version__
from kaikei.main import create_app
from kaikei.settings import Settings


def test_health_is_ok() -> None:
    response = TestClient(create_app(Settings())).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


def test_cors_allows_configured_origin_only() -> None:
    client = TestClient(create_app(Settings(cors_origins="http://ui.test")))
    allowed = client.get("/health", headers={"Origin": "http://ui.test"})
    denied = client.get("/health", headers={"Origin": "http://evil.test"})
    assert allowed.headers.get("access-control-allow-origin") == "http://ui.test"
    assert "access-control-allow-origin" not in denied.headers
