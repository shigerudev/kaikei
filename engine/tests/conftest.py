"""Load the sample group snapshot for tests that hit the HTTP API without Postgres."""

from __future__ import annotations

from pathlib import Path

import pytest

from kaikei.application.group_config import drop_all
from kaikei.application.seed import seed_memory

_PACK = Path(__file__).resolve().parents[2] / "fixtures" / "grupo-ag"


@pytest.fixture(scope="session", autouse=True)
def sample_group_snapshot():
    drop_all()
    seed_memory(_PACK, "grupo-ag", "Grupo AG")
    yield
    drop_all()
