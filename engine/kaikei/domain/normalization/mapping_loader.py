"""Load K3 account mappings from the reviewer-confirmed answer key (PLAN §6.3)."""

from __future__ import annotations

import csv
from pathlib import Path

from kaikei.domain.normalization.models import AccountMapping, Statement


def load_account_mappings(path: Path | str, company_id: str) -> dict[str, AccountMapping]:
    """Read `answer_key_mapping.csv` and keep only the rows for one company.

    Columns: entity, local_account, local_name, group_account, type, counterparty.
    `type` is PL or a BS_* subtype (BS_ASSET/BS_LIAB/BS_EQUITY) — any BS_* folds to BS.
    """
    path = Path(path)
    mappings: dict[str, AccountMapping] = {}
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["entity"] != company_id:
                continue
            local_code = row["local_account"].strip()
            raw_type = row["type"].strip().upper()
            statement = Statement.BS if raw_type.startswith("BS") else Statement.PL
            mappings[local_code] = AccountMapping(
                local_code=local_code,
                group_account_code=row["group_account"].strip(),
                statement=statement,
            )
    return mappings
