"""Resolve trading-partner text to a group company via entidades.csv aliases."""

from __future__ import annotations

import csv
import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path


def normalize_alias(text: str) -> str:
    """Casefold, strip accents, collapse whitespace — for UNIQUE(group, normalized alias)."""
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    collapsed = re.sub(r"\s+", " ", ascii_only).strip().casefold()
    return collapsed


@dataclass(frozen=True)
class Entity:
    entity_id: str
    name: str
    country: str
    currency: str
    file: str
    ownership_pct: Decimal
    aliases: tuple[str, ...]


def load_entities(path: Path | str) -> list[Entity]:
    path = Path(path)
    entities: list[Entity] = []
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            entity_id = (row.get("entity") or "").strip()
            if not entity_id:
                continue
            raw_aliases = (row.get("aliases") or "").split("|")
            aliases = tuple(a.strip() for a in raw_aliases if a.strip())
            entities.append(
                Entity(
                    entity_id=entity_id,
                    name=(row.get("name") or "").strip(),
                    country=(row.get("country") or "").strip().upper(),
                    currency=(row.get("currency") or "").strip().upper(),
                    file=(row.get("file") or "").strip(),
                    ownership_pct=Decimal((row.get("ownership_pct") or "100").strip()),
                    aliases=aliases,
                )
            )
    return entities


def resolve_alias(text: str, entities: list[Entity]) -> Entity | None:
    """Return the unique entity whose name or alias matches; None if unknown or ambiguous."""
    needle = normalize_alias(text)
    if not needle:
        return None
    hits: list[Entity] = []
    for ent in entities:
        candidates = (ent.entity_id, ent.name, *ent.aliases)
        if any(normalize_alias(c) == needle for c in candidates):
            hits.append(ent)
    if len(hits) == 1:
        return hits[0]
    return None
