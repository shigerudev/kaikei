"""Keep the in-memory run store from leaking between tests.

`pipeline` holds runs, the run order per group and recorded decisions in module-level dicts
(the documented K1 cut). A decision recorded by one test is an input to every later run, so
each test starts from an empty store — exactly what a fresh process would see.
"""

from __future__ import annotations

import pytest

from kaikei.application import pipeline
from kaikei.application import sources as sources_module


@pytest.fixture(autouse=True)
def _clean_store():
    pipeline.RUNS.clear()
    pipeline.RUN_ORDER.clear()
    pipeline.DECISIONS.clear()
    sources_module.reset_sample_packs()
    yield
    pipeline.RUNS.clear()
    pipeline.RUN_ORDER.clear()
    pipeline.DECISIONS.clear()
    sources_module.reset_sample_packs()
