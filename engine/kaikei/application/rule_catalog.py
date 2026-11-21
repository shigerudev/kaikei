"""Rule metadata for the API surface: title, error type, expected behaviour (MANIFESTO §4.3).

A `Finding` (K4, Jose's lane) carries what the *rule* produced: id, version, severity,
status, source cells, observed value, reason. The reviewer screens additionally need a short
title, the answer-key vocabulary for the kind of problem, and the sentence that says what the
engine does about it. Those are properties of the rule catalog, not of an individual finding,
so they live here as data and are joined on at the API boundary — one row per rule in
MANIFESTO §4.3, with nothing invented per finding.

Nothing here decides severity: the rule that fires owns that (§4.3 gives the default).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RuleInfo:
    """One row of the MANIFESTO §4.3 catalog, as the UI needs to label it."""

    title: str
    error_type: str
    expected_behavior: str


RULES: dict[str, RuleInfo] = {
    "VAL-002": RuleInfo(
        "Invalid monetary value",
        "invalid_amount",
        "flag the cell, never guess a figure",
    ),
    "VAL-003": RuleInfo(
        "Unmapped account",
        "unmapped_account",
        "flag unmapped, never drop silently",
    ),
    "VAL-004": RuleInfo(
        "Missing FX rate",
        "missing_fx_rate",
        "block the record, never translate without a pinned rate",
    ),
    "VAL-006": RuleInfo(
        "Duplicate record",
        "duplicate_row",
        "flag duplicate, count once",
    ),
    "VAL-007": RuleInfo(
        "Intercompany one-sided",
        "intercompany_one_sided",
        "flag unmatched intercompany, do not eliminate",
    ),
    "VAL-008": RuleInfo(
        "Intercompany amount mismatch",
        "intercompany_mismatch",
        "flag pair, do not eliminate silently",
    ),
    "VAL-010": RuleInfo(
        "Subtotal ≠ components",
        "subtotal_mismatch",
        "recompute from components, flag subtotal",
    ),
    "VAL-013": RuleInfo(
        "Unbalanced or ambiguous elimination journal",
        "journal_not_balanced",
        "refuse the journal, leave the pair uneliminated",
    ),
    "VAL-016": RuleInfo(
        "Unknown sign convention",
        "sign_convention_unknown",
        "block the source until the convention is confirmed",
    ),
    "VAL-019": RuleInfo(
        "Sign against normal balance",
        "sign_error",
        "flag reversed sign",
    ),
    "VAL-020": RuleInfo(
        "Missing month",
        "missing_period",
        "flag missing month, do not assume zero silently",
    ),
    "VAL-021": RuleInfo(
        "Currency ≠ entity currency",
        "wrong_currency",
        "flag currency not matching entity",
    ),
    "VAL-022": RuleInfo(
        "Number format vs file locale",
        "number_format",
        "detect locale mismatch, parse by locale or flag",
    ),
    "VAL-023": RuleInfo(
        "Balance sheet doesn't balance",
        "balance_not_balanced",
        "flag entity, block it from the consolidated balance",
    ),
    "VAL-024": RuleInfo(
        "Local FX assumption ignored",
        "fx_assumption_conflict",
        "ignore local rates, use the group table, report the conflict",
    ),
}

_UNKNOWN = RuleInfo("Validation finding", "validation_finding", "review before publishing")

# Rules whose BLOCKERs exclude an entity's balance sheet from the consolidated balance
# (MANIFESTO §4.3 VAL-023: "BLOCKER for that entity's balance"). Data, not a branch.
BALANCE_SCOPE_RULES: frozenset[str] = frozenset({"VAL-023"})


def rule_info(rule_id: str) -> RuleInfo:
    """Catalog row for a rule id; an unknown id is labelled plainly, never dropped."""
    return RULES.get(rule_id, _UNKNOWN)
