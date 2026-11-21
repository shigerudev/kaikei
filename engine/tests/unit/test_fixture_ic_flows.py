"""
Fixture IC flows from fixtures/grupo-ag/README.md + answer_key_errors.csv (PIPER-71 / AC5).

Candidates are already in reporting currency (post-FX). The matcher aggregates per
(company-pair, period), so fee+interest in the same month become one MATCHED group;
E02 / E08 stay out of elimination.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from kaikei.domain.intercompany import (
    IcCandidate,
    MatchStatus,
    journals_for_matches,
    load_entities,
    load_ic_tolerance,
    match_intercompany,
)

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "grupo-ag"


def _c(
    record_id: str,
    company_id: str,
    period: str,
    amount: str,
    partner_text: str,
    side: str,
) -> IcCandidate:
    return IcCandidate(
        record_id=record_id,
        company_id=company_id,
        period=period,
        amount_group=Decimal(amount),
        partner_text=partner_text,
        side=side,
    )


def _run(candidates: list[IcCandidate], run_id: str = "fixture-ic-ac5"):
    entities = load_entities(FIXTURES / "entidades.csv")
    tolerance = load_ic_tolerance(FIXTURES / "parametros_grupo.csv")
    assert tolerance == Decimal("1.00")
    return match_intercompany(
        candidates,
        entities=entities,
        run_id=run_id,
        tolerance=tolerance,
    )


def test_readme_matched_flows_eliminated():
    """README product / fee / interest / BS flows that should eliminate."""
    result = _run(
        [
            # Product EMP2 → EMP1
            _c("p-emp2-emp1-s", "EMP2", "2027-01", "52258.0645", "AG Distribución", "seller"),
            _c("p-emp2-emp1-b", "EMP1", "2027-01", "52258.0645", "AGM-GT", "buyer"),
            # Product EMP2 → EMP3
            _c("p-emp2-emp3-s", "EMP2", "2027-01", "30000.0000", "AG El Salvador", "seller"),
            _c("p-emp2-emp3-b", "EMP3", "2027-01", "30000.0000", "AGM-GT", "buyer"),
            # Management fees EMP6 → EMP1/3/4/5 (aliases from entidades.csv)
            _c("fee-emp6-emp1-s", "EMP6", "2027-01", "15000.00", "EMP1", "seller"),
            _c("fee-emp6-emp1-b", "EMP1", "2027-01", "15000.00", "Holding", "buyer"),
            _c("fee-emp6-emp3-s", "EMP6", "2027-01", "15000.00", "EMP3", "seller"),
            _c("fee-emp6-emp3-b", "EMP3", "2027-01", "15000.00", "AG HOLDING", "buyer"),
            _c("fee-emp6-emp4-s", "EMP6", "2027-01", "15000.00", "EMP4", "seller"),
            _c("fee-emp6-emp4-b", "EMP4", "2027-01", "15000.00", "AG-HOLD", "buyer"),
            _c("fee-emp6-emp5-s", "EMP6", "2027-01", "15000.00", "EMP5", "seller"),
            _c("fee-emp6-emp5-b", "EMP5", "2027-01", "15000.00", "AG Holding", "buyer"),
            # Loan interest EMP6 → EMP4 (same pair/period as fee → one aggregated MATCHED)
            _c("int-emp6-emp4-s", "EMP6", "2027-01", "4000.00", "EMP4", "seller"),
            _c("int-emp6-emp4-b", "EMP4", "2027-01", "4000.00", "Holding", "buyer"),
            # BS AR/AP EMP2 ↔ EMP1
            _c("bs-emp2-emp1-s", "EMP2", "2027-12", "77419.3548", "AG Distribución", "seller"),
            _c("bs-emp2-emp1-b", "EMP1", "2027-12", "77419.3548", "AG Manufactura", "buyer"),
            # BS loan EMP6 ↔ EMP4 (own period bucket; not mixed with E08)
            _c("bs-emp6-emp4-s", "EMP6", "2027-12", "500000.00", "EMP4", "seller"),
            _c("bs-emp6-emp4-b", "EMP4", "2027-12", "500000.00", "AG HOLDING", "buyer"),
        ]
    )

    assert all(m.status == MatchStatus.MATCHED for m in result.matches)
    # product×2 + fees EMP1/3/5 + fee+interest EMP4 + BS×2 = 8 groups
    assert len(result.matches) == 8
    journals = journals_for_matches(result)
    assert len(journals) == 8
    for j in journals:
        assert sum(line.debit for line in j.lines) == sum(line.credit for line in j.lines)


def test_e02_mismatch_not_eliminated():
    """answer_key E02: mar-2027 EMP2↔EMP1 transposed digits → VAL-008, no journal."""
    result = _run(
        [
            _c("e02-s", "EMP2", "2027-03", "427500.00", "EMP1", "seller"),
            _c("e02-b", "EMP1", "2027-03", "472500.00", "AG Manufactura", "buyer"),
        ]
    )
    assert len(result.matches) == 1
    assert result.matches[0].status == MatchStatus.MISMATCH
    assert any(f.rule_id == "VAL-008" for f in result.findings)
    assert journals_for_matches(result) == []


def test_e08_one_sided_not_eliminated():
    """answer_key E08: Dec EMP6 fee to EMP4 with no buyer row → VAL-007, no journal."""
    result = _run(
        [
            _c("e08-s", "EMP6", "2027-12", "15000.00", "EMP4", "seller"),
        ]
    )
    assert len(result.matches) == 1
    assert result.matches[0].status == MatchStatus.ONE_SIDED
    assert any(f.rule_id == "VAL-007" and "e08-s" in f.record_ids for f in result.findings)
    assert journals_for_matches(result) == []


def test_fixture_pack_ac5_combined():
    """All README flows in one run: eliminate matched; flag E02 + E08 only."""
    matched = [
        _c("p-emp2-emp1-s", "EMP2", "2027-01", "52258.0645", "AG Distribución", "seller"),
        _c("p-emp2-emp1-b", "EMP1", "2027-01", "52258.0645", "AGM-GT", "buyer"),
        _c("p-emp2-emp3-s", "EMP2", "2027-01", "30000.0000", "AG El Salvador", "seller"),
        _c("p-emp2-emp3-b", "EMP3", "2027-01", "30000.0000", "AGM-GT", "buyer"),
        _c("fee-emp6-emp1-s", "EMP6", "2027-01", "15000.00", "EMP1", "seller"),
        _c("fee-emp6-emp1-b", "EMP1", "2027-01", "15000.00", "Holding", "buyer"),
        _c("fee-emp6-emp3-s", "EMP6", "2027-01", "15000.00", "EMP3", "seller"),
        _c("fee-emp6-emp3-b", "EMP3", "2027-01", "15000.00", "AG HOLDING", "buyer"),
        _c("fee-emp6-emp4-s", "EMP6", "2027-01", "15000.00", "EMP4", "seller"),
        _c("fee-emp6-emp4-b", "EMP4", "2027-01", "15000.00", "AG-HOLD", "buyer"),
        _c("fee-emp6-emp5-s", "EMP6", "2027-01", "15000.00", "EMP5", "seller"),
        _c("fee-emp6-emp5-b", "EMP5", "2027-01", "15000.00", "AG Holding", "buyer"),
        _c("int-emp6-emp4-s", "EMP6", "2027-01", "4000.00", "EMP4", "seller"),
        _c("int-emp6-emp4-b", "EMP4", "2027-01", "4000.00", "Holding", "buyer"),
        _c("bs-emp2-emp1-s", "EMP2", "2027-12", "77419.3548", "AG Distribución", "seller"),
        _c("bs-emp2-emp1-b", "EMP1", "2027-12", "77419.3548", "AG Manufactura", "buyer"),
        # Loan BS in 2027-11 so it does not share a bucket with E08 (Dec fee)
        _c("bs-emp6-emp4-s", "EMP6", "2027-11", "500000.00", "EMP4", "seller"),
        _c("bs-emp6-emp4-b", "EMP4", "2027-11", "500000.00", "AG HOLDING", "buyer"),
        # E02 / E08
        _c("e02-s", "EMP2", "2027-03", "427500.00", "EMP1", "seller"),
        _c("e02-b", "EMP1", "2027-03", "472500.00", "AG Manufactura", "buyer"),
        _c("e08-s", "EMP6", "2027-12", "15000.00", "EMP4", "seller"),
    ]
    result = _run(matched)
    by = {s: [m for m in result.matches if m.status == s] for s in MatchStatus}
    assert len(by[MatchStatus.MATCHED]) == 8
    assert len(by[MatchStatus.MISMATCH]) == 1
    assert len(by[MatchStatus.ONE_SIDED]) == 1

    journals = journals_for_matches(result)
    assert len(journals) == 8
    elim = {rid for j in journals for rid in j.source_record_ids}
    assert elim.isdisjoint({"e02-s", "e02-b", "e08-s"})
    assert any(f.rule_id == "VAL-008" for f in result.findings)
    assert any(f.rule_id == "VAL-007" for f in result.findings)


def test_rerun_adds_no_extra_journals_per_run():
    cands = [
        _c("a-s", "EMP2", "2027-01", "100.00", "AG Distribución", "seller"),
        _c("a-b", "EMP1", "2027-01", "100.00", "AGM-GT", "buyer"),
    ]
    j1 = journals_for_matches(_run(cands, run_id="run-a"))
    j2 = journals_for_matches(_run(cands, run_id="run-b"))
    assert len(j1) == len(j2) == 1
    assert j1[0].journal_id != j2[0].journal_id
