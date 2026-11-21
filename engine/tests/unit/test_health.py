import pytest
from fastapi.testclient import TestClient

from kaikei.main import create_app
from kaikei.settings import Settings


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(Settings()))


@pytest.mark.parametrize("path", ["/health", "/api/v1/health"])
def test_health_is_ok(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == "0.1.0"


def test_cors_allows_configured_origin_only() -> None:
    client = TestClient(create_app(Settings(cors_origins="http://ui.test")))
    allowed = client.get("/health", headers={"Origin": "http://ui.test"})
    denied = client.get("/health", headers={"Origin": "http://evil.test"})
    assert allowed.headers.get("access-control-allow-origin") == "http://ui.test"
    assert "access-control-allow-origin" not in denied.headers
