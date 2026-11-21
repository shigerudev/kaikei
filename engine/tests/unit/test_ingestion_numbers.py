"""PIPER-61: locale-aware decimal / money / date / period parsing."""

from datetime import date
from decimal import Decimal

import pytest

from kaikei.domain.ingestion import (
    month_from_label,
    parse_date,
    parse_decimal,
    parse_decimal_ex,
    parse_money,
    parse_period,
)


@pytest.mark.parametrize(
    ("raw", "hint", "expected"),
    [
        ("1,200.00", "en_US", "1200.00"),
        ("1,200.00", None, "1200.00"),  # both separators: structure is unambiguous
        ("1.200,00", "es_ES", "1200.00"),
        ("1.200,00", None, "1200.00"),
        ("1.234,56", "es_ES", "1234.56"),
        ("1,234.56", "en_US", "1234.56"),
        ("(1,234.00)", "en_US", "-1234.00"),
        ("(600)", None, "-600"),
        ("-600", None, "-600"),
        ("600-", None, "-600"),
        ("+600", None, "600"),
        ("1.234", "es_ES", "1234"),  # dot is thousands in es_ES
        ("1.234", "es_GT", "1.234"),  # dot is decimal in es_GT
        ("1,234", "en_US", "1234"),
        ("1,234", "es_ES", "1.234"),
        ("0.125", None, "0.125"),  # leading zero: cannot be a thousands group
        ("1.234.567", None, "1234567"),
        ("12,5", None, "12.5"),
        ("Q 600", None, "600"),
        ("€ 1.200,50", "es_ES", "1200.50"),
        ("$1,200.00", "en_US", "1200.00"),
        ("1 234,56", "es_ES", "1234.56"),
        ("0", None, "0"),
        ("0.00", None, "0.00"),
    ],
)
def test_parse_decimal_values(raw, hint, expected):
    got = parse_decimal(raw, hint)
    assert got == Decimal(expected)
    assert isinstance(got, Decimal)


@pytest.mark.parametrize("raw", ["", "   ", None])
def test_blank_is_none_not_zero(raw):
    p = parse_decimal_ex(raw)
    assert p.value is None
    assert p.status == "blank"
    assert parse_decimal(raw) is None


@pytest.mark.parametrize("raw", ["-", "–", "—"])
def test_dash_is_placeholder_not_zero(raw):
    p = parse_decimal_ex(raw)
    assert p.value is None
    assert p.status == "placeholder"


def test_ambiguous_single_separator_without_hint_is_never_guessed():
    p = parse_decimal_ex("1.234")
    assert p.value is None
    assert p.status == "ambiguous"
    assert parse_decimal_ex("1,234").status == "ambiguous"


def test_locale_mismatch_is_flagged_and_not_misread():
    # E09 shape: dot decimal inside a comma-decimal file. Naive parse would read 1,140,000.
    p = parse_decimal_ex("11400.00", "es_ES")
    assert p.status == "locale_mismatch"
    assert p.value == Decimal("11400.00")
    # structure contradicts the hint
    assert parse_decimal_ex("1,234.56", "es_ES").status == "locale_mismatch"


@pytest.mark.parametrize(
    "raw", ["Q 1,2O0", "12a", "1.2.3,4", "1,,2", "1.", "abc", "1e5", "1,23,456"]
)
def test_invalid_numbers_rejected(raw):
    p = parse_decimal_ex(raw, "en_US")
    assert p.value is None
    assert p.status in ("invalid", "formula_like")


@pytest.mark.parametrize("raw", ["=1+1", '=HYPERLINK("x")', "@SUM(A1)", "+cmd|' /C calc'!A0"])
def test_formula_like_is_not_a_number(raw):
    p = parse_decimal_ex(raw)
    assert p.value is None
    assert p.status == "formula_like"


def test_unknown_locale_hint_raises():
    with pytest.raises(ValueError):
        parse_decimal("1", "klingon")


# ---- money (ported rules from the retired TS parseAmountToMinor) ----------


def test_money_required_cases():
    assert parse_money("1,200.00", "GTQ", "en_US").value == Decimal("1200.00")
    assert parse_money("1.200,00", "EUR", "es_ES").value == Decimal("1200.00")
    assert parse_money("Q 600", "GTQ").value == Decimal("600")
    assert parse_money("(600)", "GTQ").value == Decimal("-600")
    assert parse_money("-600", "GTQ").value == Decimal("-600")
    assert parse_money("600-", "GTQ").value == Decimal("-600")


def test_money_rejects_letter_o_and_empty():
    bad = parse_money("Q 1,2O0", "GTQ", "en_US")
    assert bad.value is None
    assert bad.status == "invalid"
    assert parse_money("", "GTQ").value is None
    assert parse_money("", "GTQ").status == "blank"


def test_money_symbol_must_match_row_currency():
    p = parse_money("Q 600", "USD")
    assert p.value is None
    assert p.status == "currency_mismatch"
    assert p.symbol_currency == "GTQ"
    assert parse_money("$ 600", "USD").value == Decimal("600")
    assert parse_money("€ 600", "USD").status == "currency_mismatch"
    assert parse_money("600 EUR", "EUR").value == Decimal("600")
    assert parse_money("GTQ 600", "EUR").status == "currency_mismatch"


def test_money_iso_4217_only():
    for bad in ("XXX", "usd", "QTZ", "", "US"):
        p = parse_money("600", bad)
        assert p.value is None
        assert p.status == "bad_currency"


def test_money_per_currency_decimals():
    assert parse_money("1,200", "JPY", "en_US").value == Decimal("1200")
    assert parse_money("10.5", "JPY", "en_US").status == "too_many_decimals"
    assert parse_money("1.005", "KWD", "en_US").value == Decimal("1.005")
    assert parse_money("10.505", "USD", "en_US").status == "too_many_decimals"
    assert parse_money("10.50", "USD", "en_US").value == Decimal("10.50")


# ---- dates and periods ----------------------------------------------------


def test_parse_date_formats():
    assert parse_date("31/01/2027") == date(2027, 1, 31)
    assert parse_date("31-Jan-2027") == date(2027, 1, 31)
    assert parse_date("31-dic-2027") == date(2027, 12, 31)
    assert parse_date("2027-03-15") == date(2027, 3, 15)
    assert parse_date("31/13/2027") is None
    assert parse_date("30/02/2027") is None
    assert parse_date("not a date") is None


def test_parse_period_formats():
    assert parse_period("ene-2027") == "2027-01"
    assert parse_period("sep-2027") == "2027-09"
    assert parse_period("2027-07") == "2027-07"
    assert parse_period("31/12/2027") == "2027-12"
    assert parse_period("30-Nov-2027") == "2027-11"
    assert parse_period("2026") == "2026"
    assert parse_period("FY2026") == "2026"
    assert parse_period("2027-13") is None
    assert parse_period("xyz-2027") is None


def test_spanish_month_headers():
    labels = "Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic".split()
    assert [month_from_label(x) for x in labels] == list(range(1, 13))
    assert month_from_label("Sept") == 9
    assert month_from_label("Diciembre") == 12
    assert month_from_label("Total") is None
