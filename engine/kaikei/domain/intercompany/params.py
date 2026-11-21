"""Group parameters from parametros_grupo.csv (IC tolerance, etc.)."""

from __future__ import annotations

import csv
from decimal import Decimal
from pathlib import Path


def load_ic_tolerance(path: Path | str, *, default: Decimal = Decimal("1.00")) -> Decimal:
    path = Path(path)
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if (row.get("parameter") or "").strip() == "ic_match_tolerance":
                return Decimal((row.get("value") or str(default)).strip())
    return default
