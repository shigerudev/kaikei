"""Mapping draft/approve on the in-memory sample group; auth routes exist."""

from fastapi.testclient import TestClient

from kaikei.main import app

client = TestClient(app)
GROUP = "grupo-ag"


def test_get_and_put_mapping_for_sample_company():
    got = client.get(f"/api/v1/groups/{GROUP}/companies/EMP1/mapping")
    assert got.status_code == 200
    body = got.json()
    assert body["company_id"] == "EMP1"
    assert body["accounts"]
    codes = {row["local_code"] for row in body["accounts"]}
    assert "4101" in codes

    put = client.put(
        f"/api/v1/groups/{GROUP}/companies/EMP1/mapping",
        json={
            "accounts": [
                {
                    "local_code": "4101",
                    "local_name": "Ventas locales",
                    "group_account": "REV_SALES",
                }
            ]
        },
    )
    assert put.status_code == 200
    assert any(r["group_account"] == "REV_SALES" for r in put.json()["accounts"])
